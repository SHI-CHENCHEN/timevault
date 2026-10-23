import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { formatMinutes, type CanonicalAction, type InstallationSnapshot, type ReflectionStep } from "@timevault/shared";
import { Button } from "./Button";
import type { HandTrackingController } from "../hooks/useHandTracking";

const REFLECTION_STEPS = [
  {
    index: 0 as const,
    label: "NOTICE",
    title: "NAME THE LOST\nMOMENT.",
    note: "Time first returns as attention. Every fragment you recognised stopped being invisible.",
    prompt: "WHAT DID THIS TIME QUIETLY TAKE FROM YOU?",
  },
  {
    index: 1 as const,
    label: "GATHER",
    title: "WATCH THE\nFRAGMENTS GATHER.",
    note: "Five minutes becomes fifteen. Fifteen becomes structure. Small intervals are already part of something larger.",
    prompt: "WHAT CHANGES WHEN THE FRAGMENTS BECOME VISIBLE?",
  },
  {
    index: 2 as const,
    label: "RETURN",
    title: "RETURN WITH\nINTENTION.",
    note: "Recovered time is not empty time. It is a space you can protect, inhabit, and choose again.",
    prompt: "WHAT WILL YOU DO WITH THE TIME THAT COMES BACK?",
  },
] as const;

export function ReflectionView({
  snapshot,
  dispatch,
  handMirror,
}: {
  snapshot: InstallationSnapshot;
  dispatch: (action: CanonicalAction) => void;
  handMirror: HandTrackingController;
}) {
  const lastWheelAt = useRef(0);
  const step = snapshot.interaction.reflectionStep;
  const chapter = REFLECTION_STEPS[step];
  const values = [snapshot.account.totalSold, snapshot.account.timeReserve, snapshot.account.totalRecovered] as const;
  const minutes = values[step];
  const reference = Math.max(60, snapshot.account.totalSold, snapshot.account.timeReserve, snapshot.account.totalRecovered);
  const progress = Math.min(1, minutes / reference);
  const units = Math.floor(minutes / 5);
  const statusLabel = {
    CAMERA_OFF: "CAMERA OFF / MANUAL CONTROL ACTIVE",
    REQUESTING_CAMERA: "REQUESTING CAMERA",
    LOADING_HAND_MODEL: "LOADING LOCAL HAND MODEL",
    SEARCHING_FOR_HANDS: "SEARCHING FOR HANDS",
    TRACKING: "HAND MIRROR ACTIVE",
    CAMERA_UNAVAILABLE: "CAMERA UNAVAILABLE / MANUAL CONTROL ACTIVE",
  }[handMirror.status];
  const trackingHint = {
    CAMERA_OFF: "ACTIVATE, THEN ALLOW CAMERA ACCESS",
    REQUESTING_CAMERA: "ALLOW CAMERA ACCESS IN THE BROWSER",
    LOADING_HAND_MODEL: "LOADING THE LOCAL MODEL — PLEASE WAIT",
    SEARCHING_FOR_HANDS: "SHOW ONE OPEN PALM IN THE CENTER",
    TRACKING: "HAND DETECTED — MOVE SLOWLY THROUGH THE FIELD",
    CAMERA_UNAVAILABLE: "CHECK CAMERA ACCESS, THEN SELECT RETRY",
  }[handMirror.status];
  const leftLabel = handMirror.ui.leftDetected && handMirror.ui.leftFingerCount >= 1 && handMirror.ui.leftFingerCount <= 3
    ? `LEFT / 0${handMirror.ui.leftFingerCount} ${REFLECTION_STEPS[handMirror.ui.leftFingerCount - 1].label}`
    : "LEFT / 1–3 CHAPTER · PALM PUSH";
  const rightLabel = handMirror.ui.rightDetected
    ? `RIGHT / ${handMirror.ui.rightMode}`
    : "RIGHT / OPEN · FIST · PINCH";
  const fieldLabel = {
    TIME_FILAMENT: "BOTH HANDS / TIME FILAMENT ACTIVE",
    PUSH: "LEFT PALM / PUSH FRAGMENTS",
    PULL: "RIGHT PINCH / PULL FRAGMENTS",
    GATHER: "RIGHT FIST / GATHER INTO TIME CORE",
    DISPERSE: "RIGHT OPEN / DISPERSE THE FIELD",
    AMBIENT: handMirror.ui.rightDetected ? "RIGHT HAND / OPEN, FIST OR PINCH" : "MOVE HANDS INTO THE FIELD",
  }[handMirror.ui.fieldMode];

  const move = (direction: 1 | -1) => dispatch({ type: direction > 0 ? "INCREASE_DURATION" : "DECREASE_DURATION" });
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const now = performance.now();
      if (Math.abs(event.deltaY) < 8 || now - lastWheelAt.current < 260) return;
      lastWheelAt.current = now;
      dispatch({ type: event.deltaY > 0 ? "INCREASE_DURATION" : "DECREASE_DURATION" });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [dispatch]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) move(1);
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) move(-1);
  };

  return (
    <section className="screen-layer reflection-experience" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="reflection-index" aria-hidden="true">
        <span>04</span><i /><span>REFLECTION / {chapter.label}</span>
      </div>

      <div className="reflection-copy" key={chapter.label}>
        <div className="state-caption"><span>TIME MIRROR</span><i>0{step + 1} / 03</i></div>
        <h1>{chapter.title}</h1>
        <p>{chapter.note}</p>
      </div>

      <div
        className="reflection-mirror"
        style={{
          "--reflection-progress": `${progress * 360}deg`,
          "--reflection-step": step,
        } as CSSProperties}
        role="slider"
        aria-label="Reflection chapter"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step + 1}
      >
        <div className="reflection-mirror__orbit reflection-mirror__orbit--outer"><i /><i /><i /></div>
        <div className="reflection-mirror__orbit reflection-mirror__orbit--inner"><i /><i /></div>
        <div className="reflection-mirror__progress" />
        <div className="reflection-mirror__center">
          <span>{chapter.label} / TIME</span>
          <strong>{formatMinutes(minutes)}</strong>
          <small>{String(units).padStart(2, "0")} × 05 MIN FRAGMENTS</small>
        </div>
        <div className="reflection-mirror__hand" aria-hidden="true" />
      </div>

      <nav className="reflection-steps" aria-label="Reflection chapters">
        {REFLECTION_STEPS.map((item) => (
          <button
            key={item.label}
            className={step === item.index ? "is-active" : ""}
            onClick={() => dispatch({ type: "SET_REFLECTION_STEP", value: item.index as ReflectionStep })}
          >
            <span>0{item.index + 1}</span><i /><strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      <blockquote key={chapter.prompt}>
        <span>KEEP THIS QUESTION</span>
        <p>{chapter.prompt}</p>
      </blockquote>

      <aside className="hand-mirror-panel" aria-live="polite">
        <div className="hand-mirror-panel__heading">
          <span>MEDIAPIPE + THREE.JS HAND FIELD</span>
          <strong>{statusLabel}</strong>
          <em>{trackingHint}</em>
        </div>
        <div className="hand-mirror-panel__signals">
          <span className={handMirror.ui.fieldMode !== "AMBIENT" ? "is-detected" : ""}>{fieldLabel}</span>
          <span className={handMirror.ui.leftDetected ? "is-detected" : ""}>{leftLabel}</span>
          <span className={handMirror.ui.rightDetected ? "is-detected" : ""}>{rightLabel}</span>
          <span className={handMirror.diagnostics.gesturePhase === "dwelling" ? "is-detected" : ""}>
            GESTURE / {handMirror.diagnostics.gesturePhase.toUpperCase()} · {Math.round(handMirror.diagnostics.dwellProgress * 100)}%
          </span>
        </div>
        <div className="hand-mirror-panel__dwell" aria-hidden="true"><i style={{ width: `${handMirror.diagnostics.dwellProgress * 100}%` }} /></div>
        <small className="hand-role-guide">LEFT / 1–3 CHAPTER · PALM PUSH<br />RIGHT / OPEN DISPERSE · FIST GATHER · PINCH PULL</small>
        {handMirror.enabled && handMirror.runtime ? <div className="hand-camera-health" role="status">
          <span>MODEL / {handMirror.runtime} · {handMirror.diagnostics.inferenceFps} FPS</span>
          <span>HANDS / {handMirror.diagnostics.detectedHandCount} OF 2 · VIDEO / {handMirror.cameraSize}</span>
          {!handMirror.ui.leftDetected && !handMirror.ui.rightDetected ? <small>Show your whole hand, 30–70 cm from the lens, with the palm facing the camera. Move it slowly in good light.</small> : null}
        </div> : null}
        {handMirror.detail ? <p>{handMirror.detail}</p> : null}
        {handMirror.failure ? <div className="hand-camera-error" role="alert"><strong>{handMirror.failure.code}</strong><p>{handMirror.failure.message}</p><p>{handMirror.failure.recovery}</p></div> : null}
        <small>LOCAL PROCESSING / NO RECORDING / NO UPLOAD</small>
        {handMirror.enabled ? (
          <div className="hand-camera-actions"><Button variant="ghost" onClick={handMirror.stop}>STOP CAMERA</Button>
            <Button variant="ghost" aria-pressed={handMirror.showPreview} onClick={handMirror.togglePreview}>{handMirror.showPreview ? "HIDE CAMERA GUIDE" : "SHOW CAMERA GUIDE"}</Button></div>
        ) : (
          <Button variant="ghost" onClick={() => void handMirror.activate()}>
            {handMirror.status === "CAMERA_UNAVAILABLE" ? "RETRY HAND MIRROR" : "ACTIVATE HAND MIRROR"}
          </Button>
        )}
      </aside>
      {handMirror.enabled && handMirror.showPreview ? <div className="hand-camera-guide" aria-hidden="true"><span>KEEP YOUR WHOLE HAND IN VIEW</span><i /><small>LOCAL LIVE PREVIEW / NOT RECORDED</small></div> : null}

      <div className="reflection-controls">
        <span>{handMirror.enabled ? "YOUR LEFT / CHAPTER + PUSH · YOUR RIGHT / SHAPE + PULL" : "SCROLL / ROTATE TO REFLECT"}</span>
        <Button variant="ghost" onClick={() => move(-1)}>PREVIOUS</Button>
        <Button variant="primary" onClick={() => dispatch({ type: "CONFIRM_TRANSACTION" })}>
          {step === 2 ? "RETURN TO THE VAULT" : "CONTINUE"}
        </Button>
      </div>
    </section>
  );
}
