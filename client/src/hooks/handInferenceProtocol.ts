import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { HandVisionFileset } from "./handAssetLoader";

export type HandWorkerRequest =
  | { type: "init"; wasmPath: string; model: Uint8Array; vision?: HandVisionFileset }
  | { type: "detect"; bitmap: ImageBitmap; capturedAt: number }
  | { type: "dispose" };

export type HandWorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "result"; result: HandLandmarkerResult; capturedAt: number; inferenceMs: number }
  | { type: "error"; message: string };
