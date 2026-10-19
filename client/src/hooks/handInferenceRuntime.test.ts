import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandDetector } from "./handInferenceRuntime";
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
    if (message.type === "init" && TestWorker.autoReady) queueMicrotask(() => this.respond({ type: "ready", delegate: "GPU" }));
  }
  respond(response: HandWorkerResponse) { this.onmessage?.({ data: response } as MessageEvent<HandWorkerResponse>); }
}

describe("background detector lifecycle", () => {
  beforeEach(() => {
    TestWorker.instances = []; TestWorker.autoReady = true;
    vi.stubGlobal("Worker", TestWorker); vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers(); });

  it("transfers raw frames and uses the capture timestamp without changing handedness", async () => {
    const detector = await createHandDetector(new Uint8Array([1, 2]), "/timevault/mediapipe", new AbortController().signal);
    expect(detector.background).toBe(true);
    const detection = detector.detect({} as HTMLVideoElement, 1234);
    await Promise.resolve(); await Promise.resolve();
    const worker = TestWorker.instances[0];
    expect(worker.messages.at(-1)).toMatchObject({ type: "detect", capturedAt: 1234 });
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

  it("times out unresponsive worker frames and permits cleanup", async () => {
    vi.useFakeTimers();
    const detector = await createHandDetector(new Uint8Array([1]), "/mediapipe", new AbortController().signal);
    const detection = detector.detect({} as HTMLVideoElement, 20);
    const rejection = expect(detection).rejects.toThrow("TIMED OUT");
    await vi.advanceTimersByTimeAsync(5000);
    await rejection; detector.close();
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
});
