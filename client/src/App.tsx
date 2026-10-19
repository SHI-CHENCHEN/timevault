import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { formatMinutes, TIME_OPTIONS, type InteractionScreen } from "@timevault/shared";
import { CameraBackdrop } from "./components/CameraBackdrop";
import { DeveloperPanel } from "./components/DeveloperPanel";
import { DigitalOrbit } from "./components/DigitalOrbit";
import { IntroSequence } from "./components/IntroSequence";
import { InteractionView } from "./components/InteractionView";
import { StatusLine } from "./components/StatusLine";
import { useInstallation } from "./hooks/useInstallation";
import { useHandTracking } from "./hooks/useHandTracking";
import { emitSoundSignal } from "./visual/soundSignals";
import { DEFAULT_VISUAL_DEBUG, type VisualDebugOptions } from "./visual/types";
import { createCoverControlState } from "./visual/coverInteraction";

export function App() {
  const { socket, snapshot, connected, notice, action, simulate } = useInstallation();
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const [introPulse, setIntroPulse] = useState<{ id: number; x: number; y: number } | null>(null);
  const [visualDebug, setVisualDebug] = useState<VisualDebugOptions>(DEFAULT_VISUAL_DEBUG);
  const [installationTime, setInstallationTime] = useState(() => new Date());
  const previousScreen = useRef<InteractionScreen | null>(null);
  const appRef = useRef<HTMLElement>(null);
  const coverControlRef = useRef(createCoverControlState());
  const setReflectionStep = useCallback((step: 0 | 1 | 2) => {
    action({ type: "SET_REFLECTION_STEP", value: step });
  }, [action]);
  const handMirror = useHandTracking({
    reflectionActive: snapshot?.interaction.currentScreen === "REFLECTION",
    reflectionStep: snapshot?.interaction.reflectionStep ?? 0,
    onReflectionStep: setReflectionStep,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setInstallationTime(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    emitSoundSignal(snapshot.interaction.currentScreen, previousScreen.current);
    previousScreen.current = snapshot.interaction.currentScreen;
  }, [snapshot?.interaction.currentScreen]);

  useEffect(() => {
    if (snapshot?.interaction.currentScreen && snapshot.interaction.currentScreen !== "IDLE") {
      setIntroVisible(false);
    }
  }, [snapshot?.interaction.currentScreen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === "d" && !snapshot?.settings.exhibitionMode) {
        event.preventDefault();
        setDeveloperOpen((current) => {
          const next = !current;
          if (next && snapshot?.interaction.currentScreen === "IDLE") action({ type: "SHOW_SETTINGS" });
          if (!next && snapshot?.interaction.currentScreen === "SETTINGS") action({ type: "GO_IDLE" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshot?.settings.exhibitionMode, snapshot?.interaction.currentScreen]);

  if (!snapshot) {
    return <main className="app loading-screen"><span className="eyebrow">TIMEVAULT</span><p>CONNECTING TO INSTALLATION…</p></main>;
  }

  const closeDeveloper = () => {
    setDeveloperOpen(false);
    if (snapshot.interaction.currentScreen === "SETTINGS") action({ type: "GO_IDLE" });
  };

  const showIntro = introVisible && snapshot.interaction.currentScreen === "IDLE";

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const host = appRef.current;
    if (!host) return;
    const x = event.clientX / Math.max(1, window.innerWidth);
    const y = event.clientY / Math.max(1, window.innerHeight);
    host.style.setProperty("--pointer-x", `${(x * 100).toFixed(2)}%`);
    host.style.setProperty("--pointer-y", `${(y * 100).toFixed(2)}%`);
    host.style.setProperty("--parallax-x", `${((x - 0.5) * -34).toFixed(2)}px`);
    host.style.setProperty("--parallax-y", `${((y - 0.5) * -24).toFixed(2)}px`);
    host.style.setProperty("--wordmark-x", `${((x - 0.5) * 24).toFixed(2)}px`);
    host.style.setProperty("--wordmark-y", `${((y - 0.5) * 16).toFixed(2)}px`);
    host.style.setProperty("--wordmark-time-x", `${((x - 0.5) * -24).toFixed(2)}px`);
    host.style.setProperty("--wordmark-time-y", `${((y - 0.5) * -10).toFixed(2)}px`);
    host.style.setProperty("--wordmark-vault-x", `${((x - 0.5) * 28).toFixed(2)}px`);
    host.style.setProperty("--wordmark-vault-y", `${((y - 0.5) * 12).toFixed(2)}px`);
    host.style.setProperty("--pointer-shift-x", `${((x - 0.5) * 22).toFixed(2)}px`);
    host.style.setProperty("--pointer-shift-y", `${((y - 0.5) * 16).toFixed(2)}px`);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    setIntroPulse((current) => ({ id: (current?.id ?? 0) + 1, x: event.clientX, y: event.clientY }));
  };

  const resetPointer = () => {
    const host = appRef.current;
    if (!host) return;
    host.style.setProperty("--pointer-x", "50%");
    host.style.setProperty("--pointer-y", "50%");
    host.style.setProperty("--parallax-x", "0px");
    host.style.setProperty("--parallax-y", "0px");
    host.style.setProperty("--wordmark-x", "0px");
    host.style.setProperty("--wordmark-y", "0px");
    host.style.setProperty("--wordmark-time-x", "0px");
    host.style.setProperty("--wordmark-time-y", "0px");
    host.style.setProperty("--wordmark-vault-x", "0px");
    host.style.setProperty("--wordmark-vault-y", "0px");
    host.style.setProperty("--pointer-shift-x", "0px");
    host.style.setProperty("--pointer-shift-y", "0px");
  };

  const durationIndex = Math.max(0, TIME_OPTIONS.indexOf(snapshot.interaction.selectedMinutes));
  const temporalFlowIndex = snapshot.interaction.currentScreen === "REFLECTION"
    ? snapshot.interaction.reflectionStep - 1
    : durationIndex - 2;
  const clock = installationTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const clockProgress = installationTime.getSeconds() / 60;

  return (
    <main
      ref={appRef}
      className={`app app--${snapshot.interaction.currentScreen.toLowerCase()} ${snapshot.interaction.currentMode === "BUY" ? "app--buy" : ""} ${showIntro ? "app--intro" : "app--entered"} ${handMirror.enabled ? "app--hand-mirror" : ""}`}
      style={{
        "--duration-shift-y": `${temporalFlowIndex * -24}px`,
        "--second-progress": clockProgress,
      } as CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerLeave={resetPointer}
    >
      <CameraBackdrop
        enabled={handMirror.enabled}
        status={handMirror.status}
        videoRef={handMirror.videoRef}
        visualRef={handMirror.visualRef}
        debug={visualDebug.showHandLandmarks}
        preview={handMirror.showPreview}
      />
      <div className="environment-art" aria-hidden="true" />
      <DigitalOrbit
        snapshot={snapshot}
        debug={visualDebug}
        introActive={showIntro}
        handMirrorEnabled={handMirror.enabled}
        handMirrorRef={handMirror.visualRef}
        coverControlRef={coverControlRef}
      />

      {showIntro ? (
        <IntroSequence
          snapshot={snapshot}
          onEnter={() => setIntroVisible(false)}
          coverControlRef={coverControlRef}
          dispatch={(value) => {
            setIntroVisible(false);
            action(value);
          }}
        />
      ) : null}

      {introPulse ? (
        <span
          key={introPulse.id}
          className={`intro-time-pulse ${showIntro ? "intro-time-pulse--cover" : "intro-time-pulse--interaction"}`}
          style={{ left: introPulse.x, top: introPulse.y }}
          aria-hidden="true"
        />
      ) : null}

      <header className="identity-lockup">
        <button
          className="identity-home"
          aria-label="TIMEVAULT — return to home"
          title={snapshot.interaction.currentScreen === "TRANSACTION_PROCESSING" || snapshot.interaction.currentScreen === "BUYBACK_COUNTDOWN" ? "Time exchange is active" : "Return to home"}
          disabled={snapshot.interaction.currentScreen === "TRANSACTION_PROCESSING" || snapshot.interaction.currentScreen === "BUYBACK_COUNTDOWN"}
          onClick={() => {
            setDeveloperOpen(false);
            action({ type: "GO_IDLE" });
            setIntroVisible(true);
          }}
        ><strong>TIMEVAULT</strong><i aria-hidden="true">↗</i></button>
        <span>A SPECULATIVE TIME EXCHANGE SYSTEM</span>
      </header>

      <div className="concept-sequence" aria-hidden="true">
        <span>FRAGMENTED TIME</span><i>01</i><span>ACCUMULATION</span><i>02</i><span>RESERVE</span>
      </div>

      <aside className="system-readout">
        <div className="reserve-signal"><span>RESERVE</span><strong>{formatMinutes(snapshot.account.timeReserve)}</strong></div>
        <StatusLine hardware={snapshot.hardware} storage={snapshot.storage} serverConnected={connected} />
      </aside>

      <aside className="time-spine" aria-label={`Installation time ${clock}`}>
        <span>LIVE / 60 SEC</span>
        <div aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          <b />
        </div>
        <time dateTime={installationTime.toISOString()}>{clock}</time>
      </aside>

      <InteractionView snapshot={snapshot} dispatch={action} handMirror={handMirror} />

      <footer className="installation-rail">
        <span>TIMEVAULT / INTERACTION SYSTEM V2</span>
        <button onClick={() => void document.documentElement.requestFullscreen?.()}>FULLSCREEN</button>
      </footer>

      {snapshot.settings.demoMode && !snapshot.settings.exhibitionMode ? (
        <span className="demo-indicator">DEMO ×{snapshot.settings.demoTimeMultiplier}</span>
      ) : null}

      {notice ? <div className="notice">{notice}</div> : null}
      {!snapshot.settings.exhibitionMode ? (
        <DeveloperPanel
          open={developerOpen}
          snapshot={snapshot}
          socket={socket}
          simulate={simulate}
          visualDebug={visualDebug}
          handMirror={handMirror}
          onVisualDebugChange={(key, value) => setVisualDebug((current) => ({ ...current, [key]: value }))}
          onClose={closeDeveloper}
        />
      ) : null}
    </main>
  );
}
