import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { HandWorkerRequest, HandWorkerResponse } from "./handInferenceProtocol";
import type { HandVisionFileset } from "./handAssetLoader";
import { acquireSessionResource } from "./handCameraRuntime";

export interface HandDetection {
  result: HandLandmarkerResult;
  capturedAt: number;
  inferenceMs: number;
}

export interface HandDetector {
  delegate: "GPU" | "CPU";
  background: boolean;
  detect: (video: HTMLVideoElement, capturedAt: number) => Promise<HandDetection>;
  close: () => void;
}

type Pending = { resolve: (response: HandWorkerResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };

async function createBackgroundDetector(model: Uint8Array, wasmPath: string, signal: AbortSignal, vision?: HandVisionFileset, delegate: "GPU" | "CPU" = "GPU"): Promise<HandDetector> {
  // A classic, bundled worker also supports MediaPipe's importScripts WASM loader.
  const worker = new Worker(new URL("./handTracking.worker.ts", import.meta.url));
  let pending: Pending | null = null;
  let closed = false;
  const settle = (response?: HandWorkerResponse, error?: Error) => {
    if (!pending) return;
    const request = pending; pending = null;
    clearTimeout(request.timer);
    if (error) request.reject(error);
    else if (response?.type === "error") request.reject(new Error(response.message));
    else if (response) request.resolve(response);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener("abort", close);
    settle(undefined, new Error("SESSION_CANCELLED"));
    worker.postMessage({ type: "dispose" } satisfies HandWorkerRequest);
    worker.terminate();
  };
  worker.onmessage = (event: MessageEvent<HandWorkerResponse>) => settle(event.data);
  worker.onerror = event => { event.preventDefault(); settle(undefined, new Error(event.message || "HAND WORKER UNAVAILABLE")); };
  worker.onmessageerror = () => settle(undefined, new Error("HAND WORKER MESSAGE FAILED"));
  signal.addEventListener("abort", close, { once: true });
  const request = (message: HandWorkerRequest, transfer: Transferable[] = [], timeout = 5000): Promise<HandWorkerResponse> => {
    if (closed || signal.aborted) return Promise.reject(new Error("SESSION_CANCELLED"));
    if (pending) return Promise.reject(new Error("HAND FRAME ALREADY IN FLIGHT"));
    return new Promise((resolve, reject) => {
      pending = { resolve, reject, timer: setTimeout(() => settle(undefined, new Error("HAND WORKER TIMED OUT")), timeout) };
      try { worker.postMessage(message, transfer); }
      catch (error) { settle(undefined, error instanceof Error ? error : new Error("HAND WORKER SEND FAILED")); }
    });
  };
  try {
    const copy = new Uint8Array(model);
    const ready = await request({ type: "init", wasmPath, model: copy, vision, delegate }, [copy.buffer], 25_000);
    if (ready.type !== "ready") throw new Error("HAND WORKER INITIALIZATION FAILED");
    return {
      delegate: ready.delegate, background: true, close,
      detect: async (video, capturedAt) => {
        const width = video.videoWidth || 640, height = video.videoHeight || 480;
        const scale = Math.min(1, 320 / Math.max(width, height));
        const capture = (promise: Promise<ImageBitmap>) => acquireSessionResource(promise, 2000, "HAND FRAME CAPTURE TIMED OUT", () => !closed && !signal.aborted, bitmap => bitmap.close());
        let bitmap: ImageBitmap;
        try { bitmap = await capture(createImageBitmap(video, { resizeWidth: Math.round(width * scale), resizeHeight: Math.round(height * scale), resizeQuality: "low" })); }
        catch (error) { if (closed || signal.aborted) throw error; bitmap = await capture(createImageBitmap(video)); }
        if (closed || signal.aborted) { bitmap.close(); throw new Error("SESSION_CANCELLED"); }
        let response: HandWorkerResponse;
        try { response = await request({ type: "detect", bitmap, capturedAt }, [bitmap]); }
        finally { bitmap.close(); }
        if (response.type !== "result") throw new Error("HAND WORKER RESULT MISSING");
        return response;
      },
    };
  } catch (error) { close(); throw error; }
}

async function openHandDetector(model: Uint8Array, wasmPath: string, signal: AbortSignal, preparedVision?: HandVisionFileset, compatibility = false): Promise<HandDetector> {
  if (!compatibility && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
    try { return await createBackgroundDetector(model, wasmPath, signal, preparedVision); }
    catch (error) { if (signal.aborted) throw error; }
  }
  // Older Safari / embedded browsers keep the proven main-thread fallback.
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  if (signal.aborted) throw new Error("SESSION_CANCELLED");
  const vision = preparedVision ?? await FilesetResolver.forVisionTasks(wasmPath);
  if (signal.aborted) throw new Error("SESSION_CANCELLED");
  const create = (delegate: "GPU" | "CPU") => HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer: model, delegate }, runningMode: "VIDEO", numHands: 2,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  let delegate: "GPU" | "CPU" = compatibility ? "CPU" : "GPU";
  let detector;
  try { detector = await create(delegate); }
  catch (error) { if (signal.aborted) throw new Error("SESSION_CANCELLED"); if (delegate === "CPU") throw error; delegate = "CPU"; detector = await create("CPU"); }
  if (signal.aborted) { detector.close(); throw new Error("SESSION_CANCELLED"); }
  return {
    delegate, background: false, close: () => detector.close(),
    detect: async (video, capturedAt) => {
      const startedAt = performance.now();
      const result = detector.detectForVideo(video, capturedAt);
      return { result, capturedAt, inferenceMs: performance.now() - startedAt };
    },
  };
}

/** GPU initialization can succeed while its first video upload fails. Recover
 * once with direct-video CPU inference, retaining the current camera session
 * and avoiding the same OffscreenCanvas/ImageBitmap failure in a second worker. */
export async function createHandDetector(model: Uint8Array, wasmPath: string, signal: AbortSignal, preparedVision?: HandVisionFileset, compatibility = false): Promise<HandDetector> {
  let backend = await openHandDetector(model, wasmPath, signal, preparedVision, compatibility);
  let closed = false;
  let recovered = compatibility;
  let slowGpuFrames = 0;
  let cpuWorkerTried = false;
  return {
    get delegate() { return backend.delegate; },
    get background() { return backend.background; },
    close() { if (closed) return; closed = true; backend.close(); },
    async detect(video, capturedAt) {
      if (closed || signal.aborted) throw new Error("SESSION_CANCELLED");
      try {
        const startedAt = performance.now();
        const detection = await backend.detect(video, capturedAt);
        // A GPU may initialize correctly yet be slower than WASM while sharing
        // graphics time with the particle field. Switch only on sustained cost.
        if (!closed && !signal.aborted && !cpuWorkerTried && backend.background && backend.delegate === "GPU") {
          slowGpuFrames = performance.now() - startedAt > 100 ? slowGpuFrames + 1 : 0;
          if (slowGpuFrames >= 6) {
            cpuWorkerTried = true;
            backend.close();
            backend = await createBackgroundDetector(model, wasmPath, signal, preparedVision, "CPU");
            if (closed || signal.aborted) { backend.close(); throw new Error("SESSION_CANCELLED"); }
            return await backend.detect(video, performance.now());
          }
        }
        return detection;
      }
      catch (error) {
        if (closed || signal.aborted || recovered || /ALREADY IN FLIGHT/.test(String(error))) throw error;
        recovered = true;
        backend.close();
        backend = await openHandDetector(model, wasmPath, signal, preparedVision, true);
        if (closed || signal.aborted) { backend.close(); throw new Error("SESSION_CANCELLED"); }
        // Initialization took time; sample the current video, not the old frame.
        return backend.detect(video, performance.now());
      }
    },
  };
}
