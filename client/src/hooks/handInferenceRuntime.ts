import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { HandWorkerRequest, HandWorkerResponse } from "./handInferenceProtocol";
import type { HandVisionFileset } from "./handAssetLoader";

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

async function createBackgroundDetector(model: Uint8Array, wasmPath: string, signal: AbortSignal, vision?: HandVisionFileset): Promise<HandDetector> {
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
    const ready = await request({ type: "init", wasmPath, model: copy, vision }, [copy.buffer], 25_000);
    if (ready.type !== "ready") throw new Error("HAND WORKER INITIALIZATION FAILED");
    return {
      delegate: ready.delegate, background: true, close,
      detect: async (video, capturedAt) => {
        const bitmap = await createImageBitmap(video);
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

export async function createHandDetector(model: Uint8Array, wasmPath: string, signal: AbortSignal, preparedVision?: HandVisionFileset): Promise<HandDetector> {
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function") {
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
  let delegate: "GPU" | "CPU" = "GPU";
  let detector;
  try { detector = await create("GPU"); }
  catch { if (signal.aborted) throw new Error("SESSION_CANCELLED"); delegate = "CPU"; detector = await create("CPU"); }
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
