export interface LandmarkLike {
  x: number;
  y: number;
  z?: number;
}

export interface HandMetrics {
  fingerCount: number;
  openness: number;
  palmX: number;
  palmY: number;
  rotation: number;
  pinch: number;
  palmSize: number;
  fist: number;
}

export interface CameraViewport {
  videoWidth: number;
  videoHeight: number;
  displayWidth: number;
  displayHeight: number;
}

/** Match CameraBackdrop's object-fit: cover, CSS mirror and subtle zoom. */
export function projectCameraPoint(point: LandmarkLike, viewport?: CameraViewport): { x: number; y: number } {
  if (!viewport || Math.min(viewport.videoWidth, viewport.videoHeight, viewport.displayWidth, viewport.displayHeight) <= 0) {
    return { x: 1 - point.x, y: point.y };
  }
  const scale = Math.max(viewport.displayWidth / viewport.videoWidth, viewport.displayHeight / viewport.videoHeight) * 1.025;
  return {
    x: 0.5 + (0.5 - point.x) * viewport.videoWidth * scale / viewport.displayWidth,
    y: 0.5 + (point.y - 0.5) * viewport.videoHeight * scale / viewport.displayHeight,
  };
}

export type GestureCandidate = 1 | 2 | 3 | null;
export type GesturePhase = "idle" | "warmup" | "candidate" | "dwelling" | "confirmed" | "waiting-for-release" | "cooldown" | "lost";

export interface GestureMachineState {
  phase: GesturePhase;
  candidate: GestureCandidate;
  candidateSince: number;
  lastGestureAt: number;
  lastSeenAt: number;
  warmupUntil: number;
  releaseSince: number;
  cooldownUntil: number;
  progress: number;
}

export interface GestureMachineConfig {
  warmupMs: number;
  candidateMs: number;
  dwellMs: number;
  neutralReleaseMs: number;
  cooldownMs: number;
  jitterGraceMs: number;
  trackingLossToleranceMs: number;
}

export const GESTURE_MACHINE_CONFIG: GestureMachineConfig = {
  warmupMs: 650,
  candidateMs: 100,
  dwellMs: 600,
  neutralReleaseMs: 250,
  cooldownMs: 650,
  jitterGraceMs: 170,
  trackingLossToleranceMs: 520,
};

export function createGestureMachineState(now = 0): GestureMachineState {
  return {
    phase: "warmup",
    candidate: null,
    candidateSince: now,
    lastGestureAt: now,
    lastSeenAt: now,
    warmupUntil: now + GESTURE_MACHINE_CONFIG.warmupMs,
    releaseSince: 0,
    cooldownUntil: 0,
    progress: 0,
  };
}

export interface GestureDwellState {
  candidate: 1 | 2 | 3 | null;
  candidateSince: number;
  lastCommittedAt: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function distance(a: LandmarkLike, b: LandmarkLike): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

export function countExtendedFingers(landmarks: LandmarkLike[]): number {
  if (landmarks.length < 21) return 0;
  const palm = averageLandmarks(landmarks, [0, 5, 9, 13, 17]);
  const fingerTriples = [
    [8, 6, 5],
    [12, 10, 9],
    [16, 14, 13],
    [20, 18, 17],
  ] as const;

  return fingerTriples.reduce((count, [tipIndex, pipIndex, mcpIndex]) => {
    const tip = landmarks[tipIndex];
    const pip = landmarks[pipIndex];
    const mcp = landmarks[mcpIndex];
    const extended = distance(tip, palm) > distance(pip, palm) * 1.13
      && distance(tip, mcp) > distance(pip, mcp) * 1.38;
    return count + Number(extended);
  }, 0);
}

export function averageLandmarks(landmarks: LandmarkLike[], indices: number[]): LandmarkLike {
  const total = indices.reduce(
    (sum, index) => ({
      x: sum.x + landmarks[index].x,
      y: sum.y + landmarks[index].y,
      z: (sum.z ?? 0) + (landmarks[index].z ?? 0),
    }),
    { x: 0, y: 0, z: 0 },
  );
  return { x: total.x / indices.length, y: total.y / indices.length, z: (total.z ?? 0) / indices.length };
}

export function deriveHandMetrics(landmarks: LandmarkLike[], viewport?: CameraViewport): HandMetrics {
  if (landmarks.length < 21) return { fingerCount: 0, openness: 0.48, palmX: 0.5, palmY: 0.5, rotation: 0, pinch: 0, palmSize: 0.13, fist: 0.52 };
  const palm = averageLandmarks(landmarks, [0, 5, 9, 13, 17]);
  const palmSpan = Math.max(0.035, distance(landmarks[5], landmarks[17]));
  const fingertipDistance = [8, 12, 16, 20]
    .reduce((total, index) => total + distance(landmarks[index], palm), 0) / 4;
  const openness = clamp((fingertipDistance / palmSpan - 0.82) / 1.18);
  const wrist = landmarks[0];
  const middleRoot = landmarks[9];
  const rotation = clamp((middleRoot.x - wrist.x) / palmSpan, -1, 1);
  const pinchDistance = distance(landmarks[4], landmarks[8]) / palmSpan;
  const pinch = clamp(1 - (pinchDistance - 0.18) / 0.62);
  const displayPalm = projectCameraPoint(palm, viewport);

  return {
    fingerCount: countExtendedFingers(landmarks),
    openness,
    palmX: displayPalm.x,
    palmY: displayPalm.y,
    rotation: -rotation,
    pinch,
    palmSize: clamp(palmSpan / 0.24, 0.28, 1),
    fist: 1 - openness,
  };
}

/** Tasks Vision labels the subject's physical hand on UNMIRRORED input.
 * CSS mirroring only changes display coordinates, not the input sent to Tasks.
 * Swap labels only if the pixels themselves were mirrored before inference.
 */
export function mapMediaPipeHandedness(raw: string, inputPixelsMirrored = false): "LEFT" | "RIGHT" | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized !== "left" && normalized !== "right") return null;
  const reported = normalized === "left" ? "LEFT" : "RIGHT";
  if (!inputPixelsMirrored) return reported;
  return reported === "LEFT" ? "RIGHT" : "LEFT";
}

export function advanceGestureMachine(
  state: GestureMachineState,
  input: { detected: boolean; fingerCount: number },
  now: number,
  currentStep: number,
  config: GestureMachineConfig = GESTURE_MACHINE_CONFIG,
): { state: GestureMachineState; commit: 0 | 1 | 2 | null } {
  const candidate = input.fingerCount >= 1 && input.fingerCount <= 3
    ? input.fingerCount as 1 | 2 | 3
    : null;
  let next = { ...state };
  let commit: 0 | 1 | 2 | null = null;
  if (state.phase === "confirmed") next.phase = "waiting-for-release";

  if (!input.detected) {
    if (now - state.lastSeenAt <= config.trackingLossToleranceMs) return { state: next, commit };
    next = { ...next, phase: "lost", candidate: null, candidateSince: now, releaseSince: 0, progress: 0 };
    return { state: next, commit };
  }

  next.lastSeenAt = now;
  if (state.phase === "lost") {
    return { state: { ...next, phase: "idle", candidate: null, candidateSince: now, lastGestureAt: now, progress: 0 }, commit };
  }
  if (state.phase === "warmup") {
    if (now < state.warmupUntil) return { state: next, commit };
    next.phase = "idle";
  }
  if (next.phase === "waiting-for-release") {
    if (candidate === null) {
      next.releaseSince = state.releaseSince || now;
      if (now - next.releaseSince >= config.neutralReleaseMs) {
        next.phase = "cooldown";
        next.cooldownUntil = now + config.cooldownMs;
        next.candidate = null;
        next.progress = 0;
      }
    } else {
      next.releaseSince = 0;
    }
    return { state: next, commit };
  }

  if (next.phase === "cooldown") {
    if (now < next.cooldownUntil) return { state: next, commit };
    next.phase = "idle";
  }

  if (candidate === null) {
    if (next.candidate !== null && now - next.lastGestureAt <= config.jitterGraceMs) return { state: next, commit };
    return { state: { ...next, phase: "idle", candidate: null, candidateSince: now, progress: 0 }, commit };
  }

  if (candidate !== next.candidate) {
    if (next.candidate !== null && now - next.lastGestureAt <= config.jitterGraceMs) return { state: next, commit };
    return {
      state: { ...next, phase: "candidate", candidate, candidateSince: now, lastGestureAt: now, progress: 0 },
      commit,
    };
  }

  next.lastGestureAt = now;
  const stableMs = now - next.candidateSince;
  next.phase = stableMs < config.candidateMs ? "candidate" : "dwelling";
  next.progress = clamp((stableMs - config.candidateMs) / config.dwellMs);
  if (stableMs >= config.candidateMs + config.dwellMs) {
    const target = (candidate - 1) as 0 | 1 | 2;
    if (target !== currentStep) commit = target;
    next.phase = "confirmed";
    next.progress = 1;
    next.releaseSince = 0;
  }
  return { state: next, commit };
}

export function advanceGestureDwell(
  state: GestureDwellState,
  fingerCount: number,
  now: number,
  currentStep: number,
  dwellMs = 380,
  cooldownMs = 720,
): { state: GestureDwellState; commit: 0 | 1 | 2 | null } {
  const candidate = fingerCount >= 1 && fingerCount <= 3 ? fingerCount as 1 | 2 | 3 : null;
  if (candidate === null) return { state: { ...state, candidate: null, candidateSince: now }, commit: null };
  if (candidate !== state.candidate) {
    return { state: { ...state, candidate, candidateSince: now }, commit: null };
  }
  const nextStep = (candidate - 1) as 0 | 1 | 2;
  if (nextStep === currentStep || now - state.candidateSince < dwellMs || now - state.lastCommittedAt < cooldownMs) {
    return { state, commit: null };
  }
  return { state: { ...state, lastCommittedAt: now, candidateSince: now }, commit: nextStep };
}
