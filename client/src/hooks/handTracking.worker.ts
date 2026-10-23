import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandWorkerRequest, HandWorkerResponse } from "./handInferenceProtocol";

let detector: HandLandmarker | null = null;
const reply = (message: HandWorkerResponse) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<HandWorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === "init") {
      const vision = message.vision ?? await FilesetResolver.forVisionTasks(message.wasmPath);
      const create = (delegate: "GPU" | "CPU") => HandLandmarker.createFromOptions(vision, {
        canvas: new OffscreenCanvas(640, 480),
        baseOptions: { modelAssetBuffer: message.model, delegate },
        runningMode: "VIDEO", numHands: 2,
        minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      let delegate: "GPU" | "CPU" = "GPU";
      try { detector = await create("GPU"); }
      catch { delegate = "CPU"; detector = await create("CPU"); }
      reply({ type: "ready", delegate });
    } else if (message.type === "detect") {
      try {
        if (!detector) throw new Error("HAND WORKER IS NOT READY");
        const startedAt = performance.now();
        const result = detector.detectForVideo(message.bitmap, message.capturedAt);
        reply({ type: "result", result, capturedAt: message.capturedAt, inferenceMs: performance.now() - startedAt });
      } finally {
        // A bitmap is transferred once, used once, then released; never recorded.
        message.bitmap.close();
      }
    } else {
      detector?.close(); detector = null;
      self.close();
    }
  } catch (error) {
    reply({ type: "error", message: error instanceof Error ? error.message : "HAND WORKER FAILED" });
  }
};
