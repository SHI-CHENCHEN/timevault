import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandDetector } from "./handInferenceRuntime";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandWorkerRequest, HandWorkerResponse } from "./handInferenceProtocol";

const fallback = vi.hoisted(() => ({ close: vi.fn(), detectForVideo: vi.fn(() => ({ landmarks: [], handedness: [], handednesses: [], worldLandmarks: [] })) }));
vi.mock("@mediapipe/tasks-vision", () => ({ FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) }, HandLandmarker: { createFromOptions: vi.fn(async () => fallback) } }));

class TestWorker {
  static instances: TestWorker[] = [];
  static autoReady = true;
  onmessage: ((event: MessageEvent<HandWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  messages: HandWorkerRequest[] = [];
  constructor() { TestWorker.instances.push(this); }
  postMessage(message: HandWorkerRequest) {
    this.messages.push(message);
    if (message.type === "init" && TestWorker.autoReady) queueMicrotask(() => this.respond({ type: "ready", delegate: message.delegate ?? "GPU" }));
  }
  respond(response: HandWorkerResponse) { this.onmessage?.({ data: response } as MessageEvent<HandWorkerResponse>); }
}

describe("background detector lifecycle", () => {
  beforeEach(() => {
    TestWorker.instances = []; TestWorker.autoReady = true;
    vi.stubGlobal("Worker", TestWorker); vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("transfers raw frames and uses the capture timestamp without changing handedness", async () => {
    const detector = await createHandDetector(new Uint8Array([1, 2]), "/timevault/mediapipe", new AbortController().signal);
    expect(detector.background).toBe(true);
    const detection = detector.detect({} as HTMLVideoElement, 1234);
    const worker = TestWorker.instances[0];
    await vi.waitFor(() => expect(worker.messages.at(-1)?.type).toBe("detect"));
    expect(worker.messages.at(-1)).toMatchObject({ type: "detect", capturedAt: 1234 });
    expect(createImageBitmap).toHaveBeenCalledWith({}, expect.objectContaining({ resizeWidth: 320, resizeHeight: 240 }));
    const result = { landmarks: [], handedness: [[{ categoryName: "Left", score: 0.9, index: 0, displayName: "Left" }]], handednesses: [], worldLandmarks: [] };
    worker.respond({ type: "result", result, capturedAt: 1234, inferenceMs: 12 });
    expect(await detection).toMatchObject({ result, capturedAt: 1234, inferenceMs: 12 });
    detector.close(); detector.close();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("does not accumulate a second request while a frame is in flight", async () => {
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const first = detector.detect({} as HTMLVideoElement, 10);
    await Promise.resolve(); await Promise.resolve();
    await expect(detector.detect({} as HTMLVideoElement, 20)).rejects.toThrow("ALREADY IN FLIGHT");
    detector.close();
    await expect(first).rejects.toThrow("SESSION_CANCELLED");
  });

  it("passes the completely downloaded local runtime to the worker", async () => {
    const vision = { wasmBinaryPath: "blob:local-wasm", wasmLoaderPath: "blob:local-loader" };
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal, vision);
    expect(TestWorker.instances[0].messages[0]).toMatchObject({ type: "init", vision });
    detector.close();
  });

  it("cancels initialization immediately on stop/remount, with no fallback or leaked worker", async () => {
    TestWorker.autoReady = false;
    const abort = new AbortController();
    const initializing = createHandDetector(new Uint8Array([1]), "/mediapipe", abort.signal);
    abort.abort();
    await expect(initializing).rejects.toThrow("SESSION_CANCELLED");
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
    expect(fallback.detectForVideo).not.toHaveBeenCalled();
  });

  it("releases a bitmap arriving after stop instead of submitting it", async () => {
    let complete!: (bitmap: ImageBitmap) => void;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal("createImageBitmap", () => new Promise<ImageBitmap>(resolve => { complete = resolve; }));
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const detection = detector.detect({} as HTMLVideoElement, 20);
    detector.close(); complete(bitmap);
    await expect(detection).rejects.toThrow("SESSION_CANCELLED");
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(TestWorker.instances[0].messages.filter(message => message.type === "detect")).toHaveLength(0);
  });

  it("terminates a failed worker before selecting the compatible detector", async () => {
    TestWorker.autoReady = false;
    const initializing = createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    TestWorker.instances[0].respond({ type: "error", message: "OFFSCREEN GPU NOT SUPPORTED" });
    const detector = await initializing;
    expect(detector.background).toBe(false);
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    await detector.detect({} as HTMLVideoElement, 90);
    expect(fallback.detectForVideo).toHaveBeenCalledWith({}, 90);
    detector.close(); expect(fallback.close).toHaveBeenCalledOnce();
  });

  it("recovers a stalled worker using direct video on CPU without reopening the camera", async () => {
    vi.useFakeTimers();
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const detection = detector.detect({} as HTMLVideoElement, 20);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await detection).toMatchObject({ result: { landmarks: [] } });
    expect(detector.delegate).toBe("CPU");
    expect(detector.background).toBe(false);
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(TestWorker.instances).toHaveLength(1);
    expect(HandLandmarker.createFromOptions).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ baseOptions: expect.objectContaining({ delegate: "CPU" }) }));
    detector.close();
  });

  it("recovers a GPU frame upload failure and resamples the current video", async () => {
    const vision = { wasmBinaryPath: "blob:session-wasm", wasmLoaderPath: "blob:session-loader" };
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal, vision);
    const video = {} as HTMLVideoElement;
    const detection = detector.detect(video, -100);
    await vi.waitFor(() => expect(TestWorker.instances[0].messages.at(-1)?.type).toBe("detect"));
    TestWorker.instances[0].respond({ type: "error", message: "WebGL context lost" });
    const result = await detection;
    expect(result.capturedAt).toBeGreaterThanOrEqual(0);
    expect(fallback.detectForVideo).toHaveBeenLastCalledWith(video, result.capturedAt);
    expect(detector.delegate).toBe("CPU");
    expect(HandLandmarker.createFromOptions).toHaveBeenLastCalledWith(vision, expect.objectContaining({ baseOptions: expect.objectContaining({ delegate: "CPU" }) }));
    detector.close();
  });

  it("allows an explicit compatible start without opening a worker", async () => {
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal, undefined, true);
    expect(TestWorker.instances).toHaveLength(0);
    expect(detector.delegate).toBe("CPU");
    detector.close();
  });

  it("does not reopen a detector when an in-flight session is cancelled", async () => {
    const abort = new AbortController();
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", abort.signal);
    const detection = detector.detect({} as HTMLVideoElement, 10);
    const rejection = expect(detection).rejects.toThrow("SESSION_CANCELLED");
    await vi.waitFor(() => expect(TestWorker.instances[0].messages.at(-1)?.type).toBe("detect"));
    abort.abort(); await rejection;
    expect(HandLandmarker.createFromOptions).not.toHaveBeenCalled();
    detector.close();
  });

  it("closes a compatible detector that finishes initializing after stop", async () => {
    let ready!: (value: HandLandmarker) => void;
    vi.mocked(HandLandmarker.createFromOptions).mockImplementationOnce(() => new Promise(resolve => { ready = resolve; }));
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const detection = detector.detect({} as HTMLVideoElement, 10);
    const rejection = expect(detection).rejects.toThrow("SESSION_CANCELLED");
    await vi.waitFor(() => expect(TestWorker.instances[0].messages.at(-1)?.type).toBe("detect"));
    TestWorker.instances[0].respond({ type: "error", message: "WebGL context lost" });
    await vi.waitFor(() => expect(ready).toBeTypeOf("function"));
    detector.close(); ready(fallback as unknown as HandLandmarker); await rejection;
    expect(fallback.close).toHaveBeenCalledOnce();
    expect(fallback.detectForVideo).not.toHaveBeenCalled();
  });

  it("does not repeat a failed CPU backend and keeps compatible teardown idempotent", async () => {
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal, undefined, true);
    fallback.detectForVideo.mockImplementationOnce(() => { throw new Error("CPU DETECTOR FAILED"); });
    await expect(detector.detect({} as HTMLVideoElement, 10)).rejects.toThrow("CPU DETECTOR FAILED");
    expect(HandLandmarker.createFromOptions).toHaveBeenCalledOnce();
    detector.close(); detector.close();
    expect(fallback.close).toHaveBeenCalledOnce();
  });

  it("recovers even when the browser never resolves video bitmap capture, and releases late bitmaps", async () => {
    vi.useFakeTimers();
    const captures: Array<(bitmap: ImageBitmap) => void> = [];
    vi.stubGlobal("createImageBitmap", () => new Promise<ImageBitmap>(resolve => captures.push(resolve)));
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const detection = detector.detect({} as HTMLVideoElement, 10);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await detection).toMatchObject({ result: { landmarks: [] } });
    expect(detector.delegate).toBe("CPU");
    expect(captures).toHaveLength(2);
    const bitmaps = captures.map(() => ({ close: vi.fn() }));
    captures.forEach((resolve, i) => resolve(bitmaps[i] as unknown as ImageBitmap));
    await Promise.resolve();
    bitmaps.forEach(bitmap => expect(bitmap.close).toHaveBeenCalledOnce());
    detector.close();
  });

  it("moves sustained slow GPU inference to a CPU worker without blocking the animation thread", async () => {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const gpu = TestWorker.instances[0];
    const result = { landmarks: [], handedness: [], handednesses: [], worldLandmarks: [] };
    for (let i = 0; i < 6; i++) {
      const sampleAt = clock;
      const pending = detector.detect({} as HTMLVideoElement, sampleAt);
      await vi.waitFor(() => expect(gpu.messages.filter(m => m.type === "detect")).toHaveLength(i + 1));
      clock += 120;
      gpu.respond({ type: "result", result, capturedAt: sampleAt, inferenceMs: 110 });
      if (i < 5) { await pending; continue; }
      await vi.waitFor(() => expect(TestWorker.instances[1]?.messages.at(-1)?.type).toBe("detect"));
      const cpu = TestWorker.instances[1];
      expect(cpu.messages[0]).toMatchObject({ type: "init", delegate: "CPU" });
      cpu.respond({ type: "result", result, capturedAt: clock, inferenceMs: 30 });
      await pending;
    }
    expect(detector.delegate).toBe("CPU");
    expect(detector.background).toBe(true);
    expect(gpu.terminate).toHaveBeenCalledOnce();
    expect(HandLandmarker.createFromOptions).not.toHaveBeenCalled();
    detector.close();
  });
});
