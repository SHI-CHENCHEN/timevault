import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

export type HandWorkerRequest =
  | { type: "init"; wasmPath: string; model: Uint8Array }
  | { type: "detect"; bitmap: ImageBitmap; capturedAt: number }
  | { type: "dispose" };

export type HandWorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "result"; result: HandLandmarkerResult; capturedAt: number; inferenceMs: number }
  | { type: "error"; message: string };
