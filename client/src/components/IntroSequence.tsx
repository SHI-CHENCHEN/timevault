import { useEffect, useRef, useState, type PointerEvent, type MutableRefObject } from "react";
import { formatMinutes, type CanonicalAction, type InstallationSnapshot } from "@timevault/shared";
import type { CoverControlState } from "../visual/coverSculpture";
import { clampCoverTilt, createCoverControlState, releaseCoverCharge } from "../visual/coverInteraction";

export function IntroSequence({
  snapshot,
  onEnter,
  dispatch,
  coverControlRef,
}: {
  snapshot: InstallationSnapshot;
  onEnter: () => void;
  dispatch: (action: CanonicalAction) => void;
  coverControlRef: MutableRefObject<CoverControlState>;
}) {
  const enterRef = useRef<HTMLButtonElement>(null);
  const wordmarkRef = useRef<HTMLButtonElement>(null);
  const wordmarkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number; lastX: number; lastAt: number; moved: boolean } | null>(null);
  const [paused, setPaused] = useState(coverControlRef.current.flowPaused);
  const [reversed, setReversed] = useState(coverControlRef.current.flowDirection === -1);
  const [feedback, setFeedback] = useState("HOLD TO ENERGISE");
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const report = (message: string) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback("HOLD TO ENERGISE"), 2200);
  };
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    if (wordmarkTimer.current) clearTimeout(wordmarkTimer.current);
    Object.assign(coverControlRef.current, createCoverControlState());
  }, [coverControlRef]);
  const finishExploration = (cancelled = false) => {
    const gesture = drag.current;
    if (!gesture) return;
    const controls = coverControlRef.current;
    if (!cancelled && !gesture.moved) {
      releaseCoverCharge(performance.now(), controls);
      report("TIME IN MOTION");
    } else {
      controls.pressed = false;
      if (cancelled || performance.now() - gesture.lastAt > 100) controls.angularVelocity = 0;
      report(cancelled ? "HOLD TO ENERGISE" : "EXPLORE EVERY ANGLE");
    }
    controls.dragging = false;
    drag.current = null;
  };
  const reverseFlow = () => {
    const next = !reversed; coverControlRef.current.flowDirection = next ? -1 : 1; setReversed(next);
    coverControlRef.current.pulseAt = performance.now(); coverControlRef.current.pulsePower = 0.7;
    report(next ? "FLOW REVERSED" : "FLOW FORWARD");
  };
  const resetVessel = () => {
    Object.assign(coverControlRef.current, createCoverControlState(), { pulseAt: performance.now() });
    setPaused(false); setReversed(false); report("VIEW RESTORED");
  };
  const moveEnter = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--magnet-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 12}px`);
    event.currentTarget.style.setProperty("--magnet-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * 8}px`);
  };
  const resetEnter = () => {
    enterRef.current?.style.setProperty("--magnet-x", "0px");
    enterRef.current?.style.setProperty("--magnet-y", "0px");
  };
  const moveWordmark = (event: PointerEvent<HTMLButtonElement>) => {
    const title = event.currentTarget;
    const bounds = title.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
    title.style.setProperty("--title-light-x", `${x * 100}%`);
    title.style.setProperty("--title-shift-x", `${(x - 0.5) * 12}px`);
    title.style.setProperty("--title-shift-y", `${(y - 0.5) * 8}px`);
  };
  const resetWordmark = () => {
    const title = wordmarkRef.current;
    if (!title) return;
    title.style.setProperty("--title-light-x", "50%");
    title.style.setProperty("--title-shift-x", "0px");
    title.style.setProperty("--title-shift-y", "0px");
  };
  const illuminateWordmark = () => {
    const title = wordmarkRef.current;
    if (!title) return;
    if (wordmarkTimer.current) clearTimeout(wordmarkTimer.current);
    title.dataset.illuminated = "true";
    wordmarkTimer.current = setTimeout(() => {
      delete title.dataset.illuminated;
      wordmarkTimer.current = null;
    }, 900);
  };

  return (
    <section className="intro-sequence" aria-label="TIMEVAULT introduction">
      <div className="intro-concept-line">
        <span>FRAGMENTED TIME</span><i>01</i><span>ACCUMULATION</span><i>02</i><span>RESERVE</span>
      </div>

      <button ref={wordmarkRef} type="button" className="intro-wordmark"
        aria-label="TIMEVAULT — illuminate title" title="Move to catch the light · click to illuminate"
        onPointerMove={moveWordmark} onPointerLeave={resetWordmark} onPointerCancel={resetWordmark}
        onPointerDown={moveWordmark} onClick={illuminateWordmark} onBlur={resetWordmark}>
        <span className="intro-wordmark__time" aria-hidden="true"><b data-text="TIME">TIME</b></span>
        <span className="intro-wordmark__vault" aria-hidden="true"><b data-text="VAULT">VAULT</b></span>
      </button>
      <p className="intro-subtitle">A SPECULATIVE TIME EXCHANGE SYSTEM</p>

      <div className="intro-reserve" aria-label={`Time reserve ${formatMinutes(snapshot.account.timeReserve)}`}>
        <span>RESERVE</span>
        <strong>{formatMinutes(snapshot.account.timeReserve)}</strong>
      </div>

      <div className="intro-editorial">
        <span>THE PERSONAL TIME RESERVE</span>
        <p>Nothing is lost all at once.<br />Little by little, time becomes yours again.</p>
      </div>
      <button className="intro-sculpture-control" aria-label="Rotate and illuminate the time vessel" aria-describedby="intro-object-hint"
        title="Drag to rotate · hold and release to energise · double-click to reverse"
        onPointerEnter={() => { coverControlRef.current.hovering = true; }}
        onPointerLeave={() => { coverControlRef.current.hovering = false; }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const controls = coverControlRef.current, now = performance.now();
          if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
          drag.current = { x: event.clientX, y: event.clientY, yaw: controls.yaw, pitch: controls.pitch, lastX: event.clientX, lastAt: now, moved: false };
          controls.pressed = true; controls.pressedAt = now; controls.angularVelocity = 0;
          setFeedback("RELEASE TO SEND A PULSE");
        }}
        onPointerMove={(event) => {
          const gesture = drag.current;
          if (!gesture) return;
          const now = performance.now(), controls = coverControlRef.current;
          if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.moved = true;
          if (gesture.moved) {
            controls.dragging = true;
            controls.yaw = gesture.yaw + (event.clientX - gesture.x) * 0.009;
            controls.pitch = clampCoverTilt(gesture.pitch + (event.clientY - gesture.y) * 0.0015);
            controls.angularVelocity = Math.max(-3, Math.min(3, (event.clientX - gesture.lastX) * 0.009 / Math.max(0.016, (now - gesture.lastAt) / 1000)));
          }
          gesture.lastX = event.clientX; gesture.lastAt = now;
        }}
        onPointerUp={() => finishExploration()}
        onPointerCancel={() => finishExploration(true)}
        onLostPointerCapture={() => finishExploration(true)}
        onDoubleClick={reverseFlow}
        onClick={(event) => {
          if (event.detail === 0) { releaseCoverCharge(performance.now(), coverControlRef.current); report("TIME IN MOTION"); }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            coverControlRef.current.angularVelocity = 0;
            coverControlRef.current.yaw += event.key === "ArrowLeft" ? -0.2 : 0.2;
            report("EXPLORE EVERY ANGLE");
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            event.stopPropagation();
            coverControlRef.current.pitch = clampCoverTilt(coverControlRef.current.pitch + (event.key === "ArrowUp" ? -0.04 : 0.04));
          }
          if (event.key === "Home") { event.preventDefault(); event.stopPropagation(); resetVessel(); }
        }}><span className="visually-hidden">Explore the TIMEVAULT installation</span></button>
      <div className="intro-object-hint" id="intro-object-hint">
        <output className="intro-vessel-feedback" aria-live="polite">{feedback}</output><i>↔</i><span>DRAG TO TURN 360°</span>
        <div className="intro-vessel-tools" aria-label="Explore the vessel without exchanging time">
          <button aria-pressed={paused} onClick={() => {
            const next = !paused; coverControlRef.current.flowPaused = next; setPaused(next); report(next ? "TIME, SUSPENDED" : "TIME IN MOTION");
          }}>{paused ? "RESUME FLOW" : "HOLD FLOW"}</button>
          <button aria-pressed={reversed} onClick={reverseFlow}>{reversed ? "FLOW FORWARD" : "REVERSE FLOW"}</button>
          <button onClick={resetVessel}>RESET VIEW</button>
        </div>
        <small>EXPLORATION ONLY · NO TIME EXCHANGED</small>
      </div>
      <aside className="intro-composition-mark">
        <span>RESERVE SIGNATURE</span>
        <strong>{String(snapshot.account.fragmentCount).padStart(2, "0")}<small>FRAGMENTS</small></strong>
        <p>NOT LOST.<br />BECOMING.</p>
      </aside>
      <div className="intro-weave-caption" aria-hidden="true">
        <span>FRAGMENTS BECOME A LIFE.</span>
        <p>{String(snapshot.account.fragmentCount).padStart(2, "0")} FIVE-MINUTE UNITS IN RESERVE</p>
      </div>
      <div className="intro-accumulation" aria-label="Time accumulation stages">
        <span>THE GRAMMAR OF TIME</span>
        <div><b>05</b><i>MICRO</i><b>15</b><i>CLUSTER</i><b>30</b><i>SHARD</i><b>60</b><i>RESERVE</i></div>
      </div>

      <button
        ref={enterRef}
        className="intro-enter"
        onPointerMove={moveEnter}
        onPointerLeave={resetEnter}
        onClick={onEnter}
      >
        <span>ENTER THE VAULT<small>MOVE / CLICK</small></span>
        <i aria-hidden="true">01</i>
      </button>

      <nav className="intro-actions" aria-label="Time exchange actions">
        <button onClick={() => dispatch({ type: "SELECT_MODE", value: "SELL" })}>
          <small>01</small><strong>SELL TIME</strong>
        </button>
        <button onClick={() => dispatch({ type: "SELECT_MODE", value: "BUY" })}>
          <small>02</small><strong>BUY BACK</strong>
        </button>
        <button onClick={() => dispatch({ type: "SHOW_HISTORY" })}>
          <small>03</small><strong>HISTORY</strong>
        </button>
        <button onClick={() => dispatch({ type: "SHOW_REFLECTION" })}>
          <small>04</small><strong>REFLECTION</strong>
        </button>
      </nav>

      <div className="intro-link-status">
        <i className={`status-dot status-dot--${snapshot.hardware.status.toLowerCase()}`} />
        <span>LINK / {snapshot.hardware.status === "CONNECTED" ? "ACTIVE" : snapshot.hardware.status}</span>
      </div>
    </section>
  );
}
