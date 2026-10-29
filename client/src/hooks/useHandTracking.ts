import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";
import type { HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { ReflectionStep } from "@timevault/shared";
import { createHandMirrorVisualState, type HandMirrorStatus, type HandMirrorVisualState, type HandSimulatorState, type HandTrackingDiagnostics } from "../visual/types";
import { loadHandAssets } from "./handAssetLoader";
import { HandIdentityTracker } from "./handIdentity";
import { acquireSessionResource, cameraErrorIssue, cameraSupportIssue, type CameraIssue } from "./handCameraRuntime";
import { advanceGestureMachine, createGestureMachineState, deriveHandMetrics, mapMediaPipeHandedness, projectCameraPoint, type CameraViewport, type GestureMachineState, type HandMetrics } from "./handTrackingMath";
import { handFieldPolicy } from "../visual/handFieldPolicy";
import { createHandDetector, type HandDetector } from "./handInferenceRuntime";
import { HAND_SAMPLE_INTERVAL_MS, HandFramePacer, isFreshHandSample, palmSmoothingMs, smoothHandValue } from "./handTrackingTiming";
import { cameraFrameToken, startHandVideoLoop } from "./handVideoLoop";

export interface HandMirrorUiSummary {
  leftDetected: boolean;
  leftFingerCount: number;
  rightDetected: boolean;
  rightMode: "DISPERSE" | "GATHER" | "PULL" | "NEUTRAL";
  fieldMode: "TIME_FILAMENT" | "PUSH" | "PULL" | "GATHER" | "DISPERSE" | "AMBIENT";
}

export interface HandTrackingController {
  enabled: boolean;
  status: HandMirrorStatus;
  detail: string | null;
  failure: CameraIssue | null;
  runtime: "GPU" | "CPU" | null;
  cameraSize: string;
  showPreview: boolean;
  togglePreview: () => void;
  ui: HandMirrorUiSummary;
  diagnostics: HandTrackingDiagnostics;
  simulator: HandSimulatorState;
  videoRef: RefObject<HTMLVideoElement | null>;
  visualRef: MutableRefObject<HandMirrorVisualState>;
  activate: (compatibility?: boolean) => Promise<void>;
  stop: () => void;
  setSimulator: (patch: Partial<HandSimulatorState>) => void;
  resetSimulator: () => void;
}

interface NormalizedHand {
  side: "LEFT" | "RIGHT";
  raw: string;
  score: number;
  metrics: HandMetrics;
  landmarks?: NormalizedLandmark[];
}

const DEFAULT_UI: HandMirrorUiSummary = { leftDetected: false, leftFingerCount: 0, rightDetected: false, rightMode: "NEUTRAL", fieldMode: "AMBIENT" };
const DEFAULT_SIMULATOR: HandSimulatorState = {
  enabled: false,
  leftDetected: true,
  rightDetected: true,
  leftGesture: 0,
  leftPalmX: 0.34,
  leftPalmY: 0.52,
  leftVelocityX: 0,
  leftVelocityY: 0,
  leftPalmSize: 0.62,
  rightPalmX: 0.68,
  rightPalmY: 0.48,
  rightVelocityX: 0,
  rightVelocityY: 0,
  rightPalmSize: 0.62,
  rightOpenness: 0.82,
  rightRotation: 0,
  rightPinch: 0,
  confidence: 0.96,
  jitter: false,
};
const DEFAULT_DIAGNOSTICS: HandTrackingDiagnostics = {
  model: "CAMERA_OFF",
  inferenceFps: 0,
  inferenceMs: 0,
  sampleAgeMs: 0,
  backgroundInference: false,
  detectedHandCount: 0,
  rawHandedness: "—",
  mappedHands: "—",
  confidence: 0,
  gesture: "NEUTRAL",
  gestureConfidence: 0,
  gestureStableMs: 0,
  dwellProgress: 0,
  gesturePhase: "idle",
  releaseGate: true,
  palm: "—",
  velocity: "—",
  palmSize: 0,
  pinch: 0,
  openness: 0,
  fist: 0,
  rotation: 0,
  lastValidDetectionAt: 0,
  simulatorActive: false,
};

// Bump this value whenever the hosted binary changes. The query prevents a
// previously broken task bundle from remaining pinned in browser/CDN caches.
const HAND_MODEL_VERSION = "float16-1-20261008b";
const HAND_MODEL_PATH = `${import.meta.env.BASE_URL}models/hand_landmarker.task?v=${HAND_MODEL_VERSION}`;
const MEDIAPIPE_WASM_PATH = `${import.meta.env.BASE_URL}mediapipe`;
const clamp = (value: number, min = -3, max = 3) => Math.min(max, Math.max(min, value));

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeout = 0;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => { timeout = window.setTimeout(() => reject(new Error(message)), ms); })]);
  } finally {
    window.clearTimeout(timeout);
  }
}

function fillDebug(buffer: Float32Array, landmarks?: NormalizedLandmark[], viewport?: CameraViewport): void {
  buffer.fill(-1);
  if (!landmarks) return;
  for (let index = 0; index < Math.min(21, landmarks.length); index += 1) {
    const point = projectCameraPoint(landmarks[index], viewport);
    buffer[index * 2] = point.x;
    buffer[index * 2 + 1] = point.y;
  }
}

function simulatedMetrics(simulator: HandSimulatorState, side: "LEFT" | "RIGHT"): HandMetrics {
  if (side === "LEFT") {
    const fingerCount = simulator.jitter && Math.floor(performance.now() / 120) % 4 === 0 ? 0 : simulator.leftGesture;
    return {
      fingerCount,
      openness: fingerCount === 0 ? 0.46 : Math.min(1, 0.34 + fingerCount * 0.16),
      palmX: simulator.leftPalmX,
      palmY: simulator.leftPalmY,
      rotation: 0,
      pinch: 0,
      palmSize: simulator.leftPalmSize,
      fist: fingerCount === 0 ? 0.54 : 0.18,
    };
  }
  return {
    fingerCount: Math.round(simulator.rightOpenness * 4),
    openness: simulator.rightOpenness,
    palmX: simulator.rightPalmX,
    palmY: simulator.rightPalmY,
    rotation: simulator.rightRotation,
    pinch: simulator.rightPinch,
    palmSize: simulator.rightPalmSize,
    fist: 1 - simulator.rightOpenness,
  };
}

export function useHandTracking({ reflectionActive, reflectionStep, onReflectionStep }: {
  reflectionActive: boolean;
  reflectionStep: ReflectionStep;
  onReflectionStep: (step: ReflectionStep) => void;
}): HandTrackingController {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraViewportRef = useRef<CameraViewport | undefined>(undefined);
  const visualRef = useRef<HandMirrorVisualState>(createHandMirrorVisualState());
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandDetector | null>(null);
  const runIdRef = useRef(0);
  const activeRef = useRef(reflectionActive);
  const startingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const videoLoopCleanupRef = useRef<(() => void) | null>(null);
  const assetCleanupRef = useRef<(() => void) | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const trackCleanupRef = useRef<(() => void) | null>(null);
  const timingRef = useRef({ inferenceMs: 0, sampleAgeMs: 0, backgroundInference: false });
  const lastUiAtRef = useRef(0);
  const stepRef = useRef(reflectionStep);
  const onStepRef = useRef(onReflectionStep);
  const statusRef = useRef<HandMirrorStatus>("CAMERA_OFF");
  const gestureRef = useRef<GestureMachineState>(createGestureMachineState());
  const simulatorRef = useRef<HandSimulatorState>(DEFAULT_SIMULATOR);
  const lastValidDetectionAtRef = useRef(0);
  const fpsRef = useRef({ startedAt: performance.now(), frames: 0, value: 0 });
  const previousHandsRef = useRef({ left: { x: 0.35, y: 0.5, at: 0 }, right: { x: 0.65, y: 0.5, at: 0 } });
  const identityRef = useRef(new HandIdentityTracker());
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<HandMirrorStatus>("CAMERA_OFF");
  const [detail, setDetail] = useState<string | null>(null);
  const [failure, setFailure] = useState<CameraIssue | null>(null);
  const [runtime, setRuntime] = useState<"GPU" | "CPU" | null>(null);
  const [cameraSize, setCameraSize] = useState("—");
  const [showPreview, setShowPreview] = useState(false);
  const [ui, setUi] = useState<HandMirrorUiSummary>(DEFAULT_UI);
  const [diagnostics, setDiagnostics] = useState<HandTrackingDiagnostics>(DEFAULT_DIAGNOSTICS);
  const [simulator, setSimulatorState] = useState<HandSimulatorState>(DEFAULT_SIMULATOR);

  stepRef.current = reflectionStep;
  activeRef.current = reflectionActive;
  onStepRef.current = onReflectionStep;
  simulatorRef.current = simulator;

  const updateStatus = useCallback((next: HandMirrorStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const releaseResources = useCallback((updateUi: boolean) => {
    runIdRef.current += 1;
    startingRef.current = false;
    abortRef.current?.abort(); abortRef.current = null;
    videoLoopCleanupRef.current?.(); videoLoopCleanupRef.current = null;
    if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current);
    watchdogRef.current = null;
    trackCleanupRef.current?.(); trackCleanupRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    assetCleanupRef.current?.(); assetCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    const visual = visualRef.current;
    Object.assign(visual, { active: false, leftDetected: false, rightDetected: false, leftRepelStrength: 0, leftConfidence: 0, rightConfidence: 0, leftVelocityX: 0, leftVelocityY: 0, rightVelocityX: 0, rightVelocityY: 0, motionEnergy: 0 });
    fillDebug(visual.debugLeft);
    fillDebug(visual.debugRight);
    previousHandsRef.current.left.at = 0; previousHandsRef.current.right.at = 0;
    identityRef.current.clear();
    if (updateUi) {
      setEnabled(false);
      setUi(DEFAULT_UI);
      setDetail(null);
      setFailure(null); setRuntime(null); setCameraSize("—"); setShowPreview(false);
      setDiagnostics(DEFAULT_DIAGNOSTICS);
      updateStatus("CAMERA_OFF");
    }
  }, [updateStatus]);

  const applyHands = useCallback((hands: NormalizedHand[], now: number, simulatorActive = false) => {
    const visual = visualRef.current;
    const sampleElapsed = visual.updatedAt ? now - visual.updatedAt : HAND_SAMPLE_INTERVAL_MS;
    const smooth = (from: number, to: number, tau = 40) => smoothHandValue(from, to, sampleElapsed, tau);
    const left = hands.find((hand) => hand.side === "LEFT") ?? null;
    const right = hands.find((hand) => hand.side === "RIGHT") ?? null;
    const applyHand = (hand: NormalizedHand, side: "left" | "right") => {
      const previous = previousHandsRef.current[side];
      const acquired = !previous.at || now - previous.at > 300;
      const elapsedMs = acquired ? HAND_SAMPLE_INTERVAL_MS : Math.max(1, now - previous.at);
      const elapsed = Math.max(0.016, Math.min(0.2, elapsedMs / 1000));
      const velocityX = simulatorActive ? simulatorRef.current[`${side}VelocityX`] : acquired ? 0 : clamp((hand.metrics.palmX - previous.x) / elapsed);
      const velocityY = simulatorActive ? simulatorRef.current[`${side}VelocityY`] : acquired ? 0 : clamp((hand.metrics.palmY - previous.y) / elapsed);
      const palmTau = palmSmoothingMs(Math.hypot(hand.metrics.palmX - previous.x, hand.metrics.palmY - previous.y));
      const follow = (from: number, to: number, tau = 28) => acquired ? to : smoothHandValue(from, to, elapsedMs, tau);
      previousHandsRef.current[side] = { x: hand.metrics.palmX, y: hand.metrics.palmY, at: now };
      if (side === "left") {
        Object.assign(visual, {
          leftDetected: true,
          leftPalmX: follow(visual.leftPalmX, hand.metrics.palmX, palmTau),
          leftPalmY: follow(visual.leftPalmY, hand.metrics.palmY, palmTau),
          leftRepelStrength: smooth(visual.leftRepelStrength, hand.score, 55),
          leftPinch: follow(visual.leftPinch, hand.metrics.pinch),
          leftVelocityX: follow(visual.leftVelocityX, velocityX, 55),
          leftVelocityY: follow(visual.leftVelocityY, velocityY, 55),
          leftPalmSize: follow(visual.leftPalmSize, hand.metrics.palmSize, 65),
          leftConfidence: hand.score,
          leftFingerCount: hand.metrics.fingerCount,
        });
        fillDebug(visual.debugLeft, hand.landmarks, cameraViewportRef.current);
      } else {
        Object.assign(visual, {
          rightDetected: true,
          rightOpenness: follow(visual.rightOpenness, hand.metrics.openness),
          rightFist: follow(visual.rightFist, hand.metrics.fist),
          rightRotation: follow(visual.rightRotation, hand.metrics.rotation),
          rightPalmX: follow(visual.rightPalmX, hand.metrics.palmX, palmTau),
          rightPalmY: follow(visual.rightPalmY, hand.metrics.palmY, palmTau),
          rightPinch: follow(visual.rightPinch, hand.metrics.pinch),
          rightVelocityX: follow(visual.rightVelocityX, velocityX, 55),
          rightVelocityY: follow(visual.rightVelocityY, velocityY, 55),
          rightPalmSize: follow(visual.rightPalmSize, hand.metrics.palmSize, 65),
          rightConfidence: hand.score,
        });
        fillDebug(visual.debugRight, hand.landmarks, cameraViewportRef.current);
      }
    };
    if (left) applyHand(left, "left");
    else {
      Object.assign(visual, { leftDetected: false, leftRepelStrength: smooth(visual.leftRepelStrength, 0, 180), leftConfidence: 0, leftVelocityX: smooth(visual.leftVelocityX, 0, 120), leftVelocityY: smooth(visual.leftVelocityY, 0, 120), leftFingerCount: 0 });
      fillDebug(visual.debugLeft);
    }
    if (right) applyHand(right, "right");
    else {
      Object.assign(visual, { rightDetected: false, rightOpenness: smooth(visual.rightOpenness, 0.48, 220), rightFist: smooth(visual.rightFist, 0.52, 220), rightConfidence: 0, rightVelocityX: smooth(visual.rightVelocityX, 0, 120), rightVelocityY: smooth(visual.rightVelocityY, 0, 120) });
      fillDebug(visual.debugRight);
    }
    const gestureResult = advanceGestureMachine(gestureRef.current, { detected: Boolean(left && left.score >= 0.56), fingerCount: left?.metrics.fingerCount ?? 0 }, now, stepRef.current);
    gestureRef.current = gestureResult.state;
    if (gestureResult.commit !== null) onStepRef.current(gestureResult.commit);
    visual.motionEnergy = smooth(visual.motionEnergy, Math.min(1, (Math.hypot(visual.leftVelocityX, visual.leftVelocityY) + Math.hypot(visual.rightVelocityX, visual.rightVelocityY)) / 2.7), 65);
    visual.updatedAt = now;
    visual.active = true;
    if (hands.length) lastValidDetectionAtRef.current = Date.now();
    updateStatus(hands.length ? "TRACKING" : "SEARCHING_FOR_HANDS");
    fpsRef.current.frames += 1;
    if (now - fpsRef.current.startedAt >= 1000) {
      fpsRef.current.value = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.startedAt));
      fpsRef.current.startedAt = now;
      fpsRef.current.frames = 0;
    }
    if (now - lastUiAtRef.current < 250) return;
    lastUiAtRef.current = now;
    const { rightMode, fieldMode } = handFieldPolicy(visual);
    const nextUi: HandMirrorUiSummary = { leftDetected: visual.leftDetected, leftFingerCount: visual.leftFingerCount, rightDetected: visual.rightDetected, rightMode, fieldMode };
    setUi(current => current.leftDetected === nextUi.leftDetected && current.leftFingerCount === nextUi.leftFingerCount && current.rightDetected === nextUi.rightDetected && current.rightMode === rightMode && current.fieldMode === fieldMode ? current : nextUi);
    const bestHand = left ?? right;
    setDiagnostics({
      model: statusRef.current,
      inferenceFps: fpsRef.current.value,
      inferenceMs: simulatorActive ? 0 : timingRef.current.inferenceMs,
      sampleAgeMs: simulatorActive ? 0 : timingRef.current.sampleAgeMs,
      backgroundInference: !simulatorActive && timingRef.current.backgroundInference,
      detectedHandCount: hands.length,
      rawHandedness: hands.map((hand) => hand.raw).join(" / ") || "—",
      mappedHands: hands.map((hand) => hand.side).join(" / ") || "—",
      confidence: bestHand?.score ?? 0,
      gesture: left && left.metrics.fingerCount >= 1 && left.metrics.fingerCount <= 3 ? `${left.metrics.fingerCount} FINGERS` : "NEUTRAL",
      gestureConfidence: left?.score ?? 0,
      gestureStableMs: gestureRef.current.candidate ? Math.max(0, now - gestureRef.current.candidateSince) : 0,
      dwellProgress: gestureRef.current.progress,
      gesturePhase: gestureRef.current.phase,
      releaseGate: gestureRef.current.phase !== "waiting-for-release",
      palm: bestHand ? `${bestHand.metrics.palmX.toFixed(2)}, ${bestHand.metrics.palmY.toFixed(2)}` : "—",
      velocity: `${visual.leftVelocityX.toFixed(2)}, ${visual.leftVelocityY.toFixed(2)}`,
      palmSize: bestHand?.metrics.palmSize ?? 0,
      pinch: bestHand?.metrics.pinch ?? 0,
      openness: right?.metrics.openness ?? 0,
      fist: right?.metrics.fist ?? 0,
      rotation: right?.metrics.rotation ?? 0,
      lastValidDetectionAt: lastValidDetectionAtRef.current,
      simulatorActive,
    });
  }, [updateStatus]);

  const applyResult = useCallback((result: HandLandmarkerResult, now: number) => {
    const video = videoRef.current;
    const viewport = video ? { videoWidth: video.videoWidth, videoHeight: video.videoHeight, displayWidth: video.clientWidth, displayHeight: video.clientHeight } : undefined;
    cameraViewportRef.current = viewport;
    const hands: Array<NormalizedHand & { x: number; y: number }> = [];
    for (const [index, landmarks] of result.landmarks.entries()) {
      const category = result.handedness?.[index]?.[0] ?? result.handednesses?.[index]?.[0];
      if (!category || category.score < 0.5 || landmarks.length < 21) continue;
      // detectForVideo receives the raw camera video, not CSS-mirrored pixels.
      const side = mapMediaPipeHandedness(category.categoryName);
      if (!side) continue;
      const palm = [0, 5, 9, 13, 17];
      hands.push({ side, raw: category.categoryName.toUpperCase(), score: category.score, metrics: deriveHandMetrics(landmarks, viewport), landmarks,
        x: palm.reduce((sum, i) => sum + landmarks[i].x, 0) / palm.length,
        y: palm.reduce((sum, i) => sum + landmarks[i].y, 0) / palm.length });
    }
    applyHands(identityRef.current.resolve(hands, now), now, false);
  }, [applyHands]);

  const setSimulator = useCallback((patch: Partial<HandSimulatorState>) => setSimulatorState((current) => ({ ...current, ...patch })), []);
  const resetSimulator = useCallback(() => setSimulatorState(DEFAULT_SIMULATOR), []);
  const stop = useCallback(() => {
    setSimulatorState((current) => ({ ...current, enabled: false }));
    releaseResources(true);
  }, [releaseResources]);

  const activate = useCallback(async (compatibility = false) => {
    if (!activeRef.current || startingRef.current || ((enabled || streamRef.current) && !compatibility)) return;
    const policy = (document as Document & { permissionsPolicy?: { allowsFeature: (feature: string) => boolean }; featurePolicy?: { allowsFeature: (feature: string) => boolean } }).permissionsPolicy
      ?? (document as Document & { featurePolicy?: { allowsFeature: (feature: string) => boolean } }).featurePolicy;
    const support = cameraSupportIssue({ secure: window.isSecureContext, media: Boolean(navigator.mediaDevices?.getUserMedia), wasm: typeof WebAssembly !== "undefined", policy: !policy || policy.allowsFeature("camera") });
    if (support) {
      setFailure(support); setDetail(null);
      updateStatus("CAMERA_UNAVAILABLE");
      return;
    }
    releaseResources(false);
    const runId = runIdRef.current;
    startingRef.current = true;
    const current = () => runId === runIdRef.current && activeRef.current;
    const assertCurrent = () => { if (!current()) throw new Error("SESSION_CANCELLED"); };
    const abort = new AbortController(); abortRef.current = abort;
    lastUiAtRef.current = 0;
    fpsRef.current = { startedAt: performance.now(), frames: 0, value: 0 };
    previousHandsRef.current.left.at = 0; previousHandsRef.current.right.at = 0;
    setEnabled(true);
    setDetail(null); setFailure(null); setRuntime(null);
    setUi(DEFAULT_UI); setDiagnostics(DEFAULT_DIAGNOSTICS);
    updateStatus("REQUESTING_CAMERA");
    try {
      const openCamera = async () => {
        try { return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } }); }
        catch (error) {
          if (error && typeof error === "object" && "name" in error && error.name === "OverconstrainedError" && current()) return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          throw error;
        }
      };
      const stream = await acquireSessionResource(openCamera(), 45_000, "CAMERA REQUEST TIMED OUT", current, value => value.getTracks().forEach(track => track.stop()));
      assertCurrent();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("VIDEO SURFACE UNAVAILABLE");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await withTimeout(video.play(), 8000, "CAMERA VIDEO DID NOT BECOME READY");
      assertCurrent();
      if (!video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await withTimeout(new Promise<void>((resolve, reject) => {
          const ready = () => { cleanup(); resolve(); };
          const cancelled = () => { cleanup(); reject(new Error("SESSION_CANCELLED")); };
          const cleanup = () => { video.removeEventListener("loadeddata", ready); abort.signal.removeEventListener("abort", cancelled); };
          video.addEventListener("loadeddata", ready, { once: true }); abort.signal.addEventListener("abort", cancelled, { once: true });
        }), 8000, "VIDEO FRAMES DID NOT ARRIVE");
      }
      assertCurrent(); setCameraSize(`${video.videoWidth} × ${video.videoHeight}`);
      updateStatus("LOADING_HAND_MODEL");
      setDetail("PREPARING HAND TRACKING / FIRST VISIT MAY TAKE A MOMENT");
      const downloads = new Map<string, { loaded: number; total: number }>();
      let reportedAt = 0;
      const wasmPath = new URL(MEDIAPIPE_WASM_PATH, window.location.href).href;
      const assets = await loadHandAssets(HAND_MODEL_PATH, wasmPath, abort.signal, value => {
        if (!current()) return;
        downloads.set(value.label, value);
        const now = performance.now();
        if (now - reportedAt < 200) return;
        reportedAt = now;
        const loaded = [...downloads.values()].reduce((sum, item) => sum + item.loaded, 0);
        setDetail(`DOWNLOADING HAND TRACKING / ${(loaded / 1_048_576).toFixed(1)} MB · KEEP THIS TAB OPEN`);
      });
      if (!current()) { assets.dispose(); assertCurrent(); }
      // Runtime recovery may initialize a CPU detector later in this session.
      // Its local WASM URLs must remain valid until the detector is closed.
      assetCleanupRef.current = assets.dispose;
      setDetail("STARTING HAND TRACKING / DOWNLOAD COMPLETE");
      const landmarker = await acquireSessionResource(createHandDetector(assets.model, wasmPath, abort.signal, assets.vision, compatibility), 40_000, "HAND MODEL INITIALIZATION TIMED OUT", current, value => value.close());
      assertCurrent(); setRuntime(landmarker.delegate);
      timingRef.current = { inferenceMs: 0, sampleAgeMs: 0, backgroundInference: landmarker.background };
      landmarkerRef.current = landmarker;
      gestureRef.current = createGestureMachineState(performance.now());
      visualRef.current.active = true;
      setDetail("WARMING UP HAND FIELD");
      updateStatus("SEARCHING_FOR_HANDS");
      startingRef.current = false;
      let lastFrameAt = performance.now();
      const pacer = new HandFramePacer();
      let warmedUp = false;
      let staleSamples = 0;
      let frameEpoch = 0;
      let reportedRuntime = landmarker.delegate;
      const fail = (error: unknown) => {
        if (!current()) return;
        releaseResources(false); setEnabled(false); setShowPreview(false);
        setFailure(cameraErrorIssue(error)); setDetail(null); updateStatus("CAMERA_UNAVAILABLE");
      };
      const ended = () => fail(new Error("CAMERA VIDEO TRACK ENDED"));
      stream.getVideoTracks().forEach(track => track.addEventListener("ended", ended));
      const visibilityChanged = () => {
        frameEpoch++;
        lastFrameAt = performance.now();
        gestureRef.current = createGestureMachineState(lastFrameAt);
        previousHandsRef.current.left.at = 0; previousHandsRef.current.right.at = 0;
        identityRef.current.clear();
        if (document.hidden) applyHands([], lastFrameAt);
      };
      document.addEventListener("visibilitychange", visibilityChanged);
      trackCleanupRef.current = () => {
        stream.getVideoTracks().forEach(track => track.removeEventListener("ended", ended));
        document.removeEventListener("visibilitychange", visibilityChanged);
      };
      const detect = (_frameTime: number) => {
        if (!current()) return;
        if (document.hidden || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        const now = performance.now();
        if (!pacer.begin(now, cameraFrameToken(video, now))) return;
        lastFrameAt = now;
        const epoch = frameEpoch;
        // One in-flight frame only. Skip arriving frames while busy instead of
        // queuing work that would make the field follow the past.
        void landmarker.detect(video, now).then(detection => {
          pacer.complete(detection.inferenceMs, landmarker.background);
          if (!current() || document.hidden || epoch !== frameEpoch) return;
          if (reportedRuntime !== landmarker.delegate) { reportedRuntime = landmarker.delegate; setRuntime(reportedRuntime); }
          const receivedAt = performance.now();
          timingRef.current = { inferenceMs: detection.inferenceMs, sampleAgeMs: receivedAt - detection.capturedAt, backgroundInference: landmarker.background };
          if (!isFreshHandSample(detection.capturedAt, receivedAt, detection.inferenceMs)) {
            applyHands([], receivedAt);
            if (++staleSamples >= 4) setDetail("HAND TRACKING IS SLOW / CLOSE OTHER HEAVY TABS OR TRY CHROME");
            return;
          }
          if (staleSamples >= 4) setDetail(null);
          staleSamples = 0;
          applyResult(detection.result, detection.capturedAt);
          if (!warmedUp && receivedAt >= gestureRef.current.warmupUntil) { warmedUp = true; setDetail(null); }
        }).catch(fail);
      };
      watchdogRef.current = window.setInterval(() => {
        if (document.hidden) { lastFrameAt = performance.now(); return; }
        if (performance.now() - lastFrameAt > 12_000) fail(new Error("VIDEO FRAMES STOPPED"));
      }, 2000);
      videoLoopCleanupRef.current = startHandVideoLoop(detect);
    } catch (error) {
      if (!current()) return;
      releaseResources(false);
      setEnabled(false);
      setFailure(cameraErrorIssue(error)); setDetail(null); setShowPreview(false);
      updateStatus("CAMERA_UNAVAILABLE");
    }
  }, [applyHands, applyResult, enabled, reflectionActive, releaseResources, updateStatus]);

  useEffect(() => {
    if (!simulator.enabled || !reflectionActive) return;
    releaseResources(false);
    setEnabled(true);
    setDetail("DETERMINISTIC HAND SIMULATOR");
    cameraViewportRef.current = undefined;
    updateStatus("TRACKING");
    gestureRef.current = createGestureMachineState(performance.now());
    const interval = window.setInterval(() => {
      const current = simulatorRef.current;
      const hands: NormalizedHand[] = [];
      if (current.leftDetected) hands.push({ side: "LEFT", raw: "SIM LEFT", score: current.confidence, metrics: simulatedMetrics(current, "LEFT") });
      if (current.rightDetected) hands.push({ side: "RIGHT", raw: "SIM RIGHT", score: current.confidence, metrics: simulatedMetrics(current, "RIGHT") });
      applyHands(hands, performance.now(), true);
    }, HAND_SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [applyHands, reflectionActive, releaseResources, simulator.enabled, updateStatus]);

  useEffect(() => {
    if (!reflectionActive && (enabled || streamRef.current || simulator.enabled)) stop();
  }, [enabled, reflectionActive, simulator.enabled, stop]);
  useEffect(() => () => releaseResources(false), [releaseResources]);

  return { enabled, status, detail, failure, runtime, cameraSize, showPreview, togglePreview: () => setShowPreview(value => !value), ui, diagnostics, simulator, videoRef, visualRef, activate, stop, setSimulator, resetSimulator };
}
