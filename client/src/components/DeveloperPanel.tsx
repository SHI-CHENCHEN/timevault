import { useEffect, useState } from "react";
import type { CanonicalAction, InstallationSnapshot } from "@timevault/shared";
import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@timevault/shared";
import { Button } from "./Button";
import type { VisualDebugOptions } from "../visual/types";
import type { HandTrackingController } from "../hooks/useHandTracking";

type TimeVaultSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function DeveloperPanel({
  open,
  snapshot,
  socket,
  simulate,
  visualDebug,
  handMirror,
  onVisualDebugChange,
  onClose,
}: {
  open: boolean;
  snapshot: InstallationSnapshot;
  socket: TimeVaultSocket;
  simulate: (action: CanonicalAction) => void;
  visualDebug: VisualDebugOptions;
  handMirror: HandTrackingController;
  onVisualDebugChange: (key: keyof VisualDebugOptions, value: boolean) => void;
  onClose: () => void;
}) {
  const [multiplier, setMultiplier] = useState(snapshot.settings.demoTimeMultiplier);
  useEffect(() => setMultiplier(snapshot.settings.demoTimeMultiplier), [snapshot.settings.demoTimeMultiplier]);
  if (!open) return null;

  const run = (action: CanonicalAction) => {
    if (snapshot.interaction.currentScreen === "SETTINGS") simulate({ type: "GO_IDLE" });
    simulate(action);
  };

  return (
    <aside className="developer-panel" aria-label="Developer simulator">
      <div className="developer-heading">
        <div><span className="eyebrow">SHIFT + D</span><h2>DEVELOPMENT</h2></div>
        <Button variant="ghost" onClick={onClose}>CLOSE</Button>
      </div>

      <section>
        <h3>HARDWARE SIMULATOR</h3>
        <div className="button-grid">
          <Button onClick={() => socket.emit("simulator_connection", true)}>CONNECTED</Button>
          <Button onClick={() => socket.emit("simulator_connection", false)}>DISCONNECTED</Button>
          <Button onClick={() => run({ type: "SELECT_MODE", value: "SELL" })}>SELL BUTTON</Button>
          <Button onClick={() => run({ type: "SELECT_MODE", value: "BUY" })}>BUY BACK BUTTON</Button>
          <Button onClick={() => run({ type: "DECREASE_DURATION" })}>ENCODER CCW</Button>
          <Button onClick={() => run({ type: "INCREASE_DURATION" })}>ENCODER CW</Button>
          <Button onClick={() => run({ type: "CONFIRM_TRANSACTION" })}>CONFIRM</Button>
          <Button onClick={() => run({ type: "CANCEL" })}>CANCEL</Button>
          <Button onClick={() => socket.emit("simulator_feedback", "LED")}>LED FEEDBACK</Button>
          <Button onClick={() => socket.emit("simulator_feedback", "SERVO")}>SERVO FEEDBACK</Button>
        </div>
      </section>

      <section>
        <h3>HAND FIELD SIMULATOR</h3>
        <div className="button-grid">
          <Button onClick={() => handMirror.setSimulator({ enabled: !handMirror.simulator.enabled })}>
            {handMirror.simulator.enabled ? "STOP HAND SIM" : "START HAND SIM"}
          </Button>
          <Button onClick={() => handMirror.setSimulator({ leftDetected: !handMirror.simulator.leftDetected })}>LEFT {handMirror.simulator.leftDetected ? "LOST" : "APPEAR"}</Button>
          <Button onClick={() => handMirror.setSimulator({ rightDetected: !handMirror.simulator.rightDetected })}>RIGHT {handMirror.simulator.rightDetected ? "LOST" : "APPEAR"}</Button>
          {[1, 2, 3].map((gesture) => (
            <Button key={gesture} onClick={() => handMirror.setSimulator({ leftGesture: gesture as 1 | 2 | 3 })}>LEFT {gesture}</Button>
          ))}
          <Button onClick={() => handMirror.setSimulator({ leftGesture: 0 })}>NEUTRAL / RELEASE</Button>
          <Button onClick={() => handMirror.setSimulator({ rightOpenness: 0.92, rightPinch: 0 })}>RIGHT OPEN</Button>
          <Button onClick={() => handMirror.setSimulator({ rightOpenness: 0.12, rightPinch: 0 })}>RIGHT FIST</Button>
          <Button onClick={() => handMirror.setSimulator({ rightPinch: handMirror.simulator.rightPinch > 0.4 ? 0 : 0.9 })}>RIGHT PINCH</Button>
          <Button onClick={() => handMirror.setSimulator({ jitter: !handMirror.simulator.jitter })}>JITTER {handMirror.simulator.jitter ? "OFF" : "ON"}</Button>
          <Button onClick={handMirror.resetSimulator}>RESET HANDS</Button>
        </div>
        {([
          ["leftPalmX", "LEFT X", 0, 1, 0.01],
          ["leftPalmY", "LEFT Y", 0, 1, 0.01],
          ["leftVelocityX", "LEFT VELOCITY X", -3, 3, 0.1],
          ["leftPalmSize", "LEFT PALM SIZE", 0.28, 1, 0.01],
          ["rightPalmX", "RIGHT X", 0, 1, 0.01],
          ["rightPalmY", "RIGHT Y", 0, 1, 0.01],
          ["rightOpenness", "RIGHT OPENNESS", 0, 1, 0.01],
          ["rightRotation", "RIGHT ROTATION", -1, 1, 0.01],
          ["confidence", "CONFIDENCE", 0, 1, 0.01],
        ] as Array<[keyof typeof handMirror.simulator, string, number, number, number]>).map(([key, label, min, max, step]) => (
          <label className="hand-sim-range" key={key}>
            <span>{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={Number(handMirror.simulator[key])}
              onChange={(event) => handMirror.setSimulator({ [key]: Number(event.target.value) })}
            />
            <output>{Number(handMirror.simulator[key]).toFixed(2)}</output>
          </label>
        ))}
        <div className="hand-diagnostics">
          {Object.entries({
            MODEL: handMirror.diagnostics.model,
            "INFERENCE FPS": handMirror.diagnostics.inferenceFps,
            HANDS: handMirror.diagnostics.detectedHandCount,
            "RAW / MAPPED": `${handMirror.diagnostics.rawHandedness} → ${handMirror.diagnostics.mappedHands}`,
            CONFIDENCE: handMirror.diagnostics.confidence.toFixed(2),
            GESTURE: `${handMirror.diagnostics.gesture} / ${handMirror.diagnostics.gesturePhase}`,
            "STABLE / DWELL": `${Math.round(handMirror.diagnostics.gestureStableMs)} MS / ${Math.round(handMirror.diagnostics.dwellProgress * 100)}%`,
            "RELEASE GATE": handMirror.diagnostics.releaseGate ? "OPEN" : "WAITING",
            PALM: handMirror.diagnostics.palm,
            VELOCITY: handMirror.diagnostics.velocity,
            "SIZE / PINCH": `${handMirror.diagnostics.palmSize.toFixed(2)} / ${handMirror.diagnostics.pinch.toFixed(2)}`,
            "OPEN / FIST / ROT": `${handMirror.diagnostics.openness.toFixed(2)} / ${handMirror.diagnostics.fist.toFixed(2)} / ${handMirror.diagnostics.rotation.toFixed(2)}`,
            "LAST VALID": handMirror.diagnostics.lastValidDetectionAt ? new Date(handMirror.diagnostics.lastValidDetectionAt).toLocaleTimeString() : "—",
          }).map(([label, value]) => <p className="developer-log" key={label}><b>{label}</b> {value}</p>)}
        </div>
      </section>

      <section>
        <h3>COUNTDOWN</h3>
        <label className="toggle-row">
          <span>DEMO TIME</span>
          <input
            type="checkbox"
            checked={snapshot.settings.demoMode}
            onChange={(event) => socket.emit("action", { type: "SET_DEMO_MODE", value: event.target.checked })}
          />
        </label>
        <label className="field-row">
          <span>DEMO MULTIPLIER</span>
          <input type="number" min="1" max="600" value={multiplier} onChange={(event) => setMultiplier(Number(event.target.value))} />
          <Button onClick={() => socket.emit("action", { type: "SET_DEMO_MULTIPLIER", value: multiplier })}>APPLY</Button>
        </label>
      </section>

      <section>
        <h3>DATA</h3>
        <div className="button-grid">
          <Button onClick={() => socket.emit("add_test_reserve", 30)}>ADD 30 MIN TEST RESERVE</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Reset all TIMEVAULT account, fragment, and transaction data?")) socket.emit("reset_database");
            }}
          >RESET DATABASE</Button>
        </div>
      </section>

      <section>
        <h3>VISUAL DEBUG</h3>
        <div className="debug-toggle-grid">
          {([
            ["showFragmentIds", "FRAGMENT IDS"],
            ["showOrbitAnchors", "ORBIT ANCHORS"],
            ["showClusterGroups", "CLUSTER GROUPS"],
            ["showFps", "FPS"],
            ["showFragmentCount", "FRAGMENT COUNT"],
            ["showRawReserveMinutes", "RAW RESERVE"],
            ["showHandLandmarks", "HAND LANDMARKS"],
          ] as Array<[keyof VisualDebugOptions, string]>).map(([key, label]) => (
            <label className="debug-toggle" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={visualDebug[key]}
                onChange={(event) => onVisualDebugChange(key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3>SERIAL PORT</h3>
        <div className="serial-row">
          <Button onClick={() => socket.emit("refresh_ports")}>REFRESH PORTS</Button>
          <Button onClick={() => socket.emit("disconnect_port")}>DISCONNECT</Button>
        </div>
        {snapshot.hardware.availablePorts.map((port) => (
          <button className="port-row" key={port.path} onClick={() => socket.emit("connect_port", port.path)}>
            <span>{port.path}</span><small>{port.manufacturer ?? "SERIAL DEVICE"}</small>
          </button>
        ))}
        {snapshot.hardware.error ? <p className="hardware-error">{snapshot.hardware.error}</p> : null}
        <p className="developer-log">RX: {snapshot.hardware.lastMessage ?? "—"}</p>
        <p className="developer-log">TX: {snapshot.hardware.lastFeedback ?? "—"}</p>
      </section>
    </aside>
  );
}
