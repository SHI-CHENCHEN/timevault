export interface VisualDebugOptions {
  showFragmentIds: boolean;
  showOrbitAnchors: boolean;
  showClusterGroups: boolean;
  showFps: boolean;
  showFragmentCount: boolean;
  showRawReserveMinutes: boolean;
  showHandLandmarks: boolean;
}

export const DEFAULT_VISUAL_DEBUG: VisualDebugOptions = {
  showFragmentIds: false,
  showOrbitAnchors: false,
  showClusterGroups: false,
  showFps: false,
  showFragmentCount: false,
  showRawReserveMinutes: false,
  showHandLandmarks: false,
};

export type HandMirrorStatus =
  | "CAMERA_OFF"
  | "REQUESTING_CAMERA"
  | "LOADING_HAND_MODEL"
  | "SEARCHING_FOR_HANDS"
  | "TRACKING"
  | "CAMERA_UNAVAILABLE";

export type HandGesturePhase =
  | "idle"
  | "warmup"
  | "candidate"
  | "dwelling"
  | "confirmed"
  | "waiting-for-release"
  | "cooldown"
  | "lost";

export interface HandTrackingDiagnostics {
  model: HandMirrorStatus;
  inferenceFps: number;
  detectedHandCount: number;
  rawHandedness: string;
  mappedHands: string;
  confidence: number;
  gesture: string;
  gestureConfidence: number;
  gestureStableMs: number;
  dwellProgress: number;
  gesturePhase: HandGesturePhase;
  releaseGate: boolean;
  palm: string;
  velocity: string;
  palmSize: number;
  pinch: number;
  openness: number;
  fist: number;
  rotation: number;
  lastValidDetectionAt: number;
  simulatorActive: boolean;
}

export interface HandSimulatorState {
  enabled: boolean;
  leftDetected: boolean;
  rightDetected: boolean;
  leftGesture: 0 | 1 | 2 | 3 | 4;
  leftPalmX: number;
  leftPalmY: number;
  leftVelocityX: number;
  leftVelocityY: number;
  leftPalmSize: number;
  rightPalmX: number;
  rightPalmY: number;
  rightVelocityX: number;
  rightVelocityY: number;
  rightPalmSize: number;
  rightOpenness: number;
  rightRotation: number;
  rightPinch: number;
  confidence: number;
  jitter: boolean;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface HandMirrorVisualState {
  active: boolean;
  leftDetected: boolean;
  leftPalmX: number;
  leftPalmY: number;
  leftRepelStrength: number;
  leftPinch: number;
  leftVelocityX: number;
  leftVelocityY: number;
  leftPalmSize: number;
  leftConfidence: number;
  leftFingerCount: number;
  rightDetected: boolean;
  rightOpenness: number;
  rightRotation: number;
  rightPalmX: number;
  rightPalmY: number;
  rightPinch: number;
  rightVelocityX: number;
  rightVelocityY: number;
  rightPalmSize: number;
  rightConfidence: number;
  rightFist: number;
  motionEnergy: number;
  updatedAt: number;
  debugLeft: Float32Array;
  debugRight: Float32Array;
}

export function createHandMirrorVisualState(): HandMirrorVisualState {
  return {
    active: false,
    leftDetected: false,
    leftPalmX: 0.35,
    leftPalmY: 0.5,
    leftRepelStrength: 0,
    leftPinch: 0,
    leftVelocityX: 0,
    leftVelocityY: 0,
    leftPalmSize: 0.13,
    leftConfidence: 0,
    leftFingerCount: 0,
    rightDetected: false,
    rightOpenness: 0.48,
    rightRotation: 0,
    rightPalmX: 0.65,
    rightPalmY: 0.5,
    rightPinch: 0,
    rightVelocityX: 0,
    rightVelocityY: 0,
    rightPalmSize: 0.13,
    rightConfidence: 0,
    rightFist: 0.52,
    motionEnergy: 0,
    updatedAt: 0,
    debugLeft: new Float32Array(42).fill(-1),
    debugRight: new Float32Array(42).fill(-1),
  };
}
