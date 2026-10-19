import { useState } from "react";
import { formatCountdown, formatMinutes, type InstallationSnapshot } from "@timevault/shared";
import { Button } from "./Button";

/** The existing timestamp-derived countdown remains authoritative. */
export function ActiveTime({ snapshot }: { snapshot: InstallationSnapshot }) {
  const [focused, setFocused] = useState(false);
  const remaining = snapshot.countdown?.remainingSeconds ?? 0;
  const total = snapshot.countdown?.totalSeconds ?? 1;
  const fraction = Math.min(1, Math.max(0, remaining / Math.max(1, total)));
  const [minutes, seconds] = formatCountdown(remaining).split(":");
  return (
    <section className={`screen-layer active-time ${focused ? "active-time--focused" : ""}`} aria-labelledby="active-time-title">
      <header className="active-time-heading"><span>BUY BACK / ACTIVE TIME</span><span><i />TIME IS YOURS</span></header>
      <div className="active-time-body">
        <div className="active-time-copy">
          <span>PROTECTED INTERVAL</span>
          <h1 id="active-time-title">A little space.<br />For you.</h1>
          <p>The reserve has released this time.<br />Choose what deserves your attention.</p>
          <dl><div><dt>RECOVERED</dt><dd>{String(snapshot.interaction.selectedMinutes).padStart(2, "0")} MIN</dd></div>
            <div><dt>RESERVE NOW</dt><dd>{formatMinutes(snapshot.account.timeReserve)}</dd></div></dl>
        </div>
        <div className="active-time-clock">
          <svg viewBox="0 0 420 420" aria-hidden="true">
            <circle className="active-time-clock__edge" cx="210" cy="210" r="196" />
            <circle className="active-time-clock__track" cx="210" cy="210" r="168" />
            <circle className="active-time-clock__remaining" cx="210" cy="210" r="168" pathLength="1"
              strokeDasharray={`${fraction} 1`} transform="rotate(-90 210 210)" />
            {Array.from({ length: 60 }, (_, index) => {
              const angle = index / 60 * Math.PI * 2 - Math.PI / 2;
              return <line key={index} x1={210 + Math.cos(angle) * (index % 5 ? 187 : 180)} y1={210 + Math.sin(angle) * (index % 5 ? 187 : 180)}
                x2={210 + Math.cos(angle) * 194} y2={210 + Math.sin(angle) * 194} />;
            })}
          </svg>
          <div className="active-time-clock__value"><span>TIME REMAINING</span>
            <time aria-label={`${minutes} minutes ${seconds} seconds`}><b>{minutes}</b><i>:</i><b>{seconds}</b></time>
            <small>MINUTES <i>/</i> SECONDS</small>
          </div>
        </div>
      </div>
      <footer className="active-time-footer">
        <p>{snapshot.settings.demoMode ? `DEMONSTRATION / ${snapshot.countdown?.multiplier ?? snapshot.settings.demoTimeMultiplier}× TIME` : "YOUR INTERVAL CONTINUES WHILE THIS PAGE IS HIDDEN"}<small>Focus changes the view, not the countdown.</small></p>
        <Button variant="ghost" className="active-time-focus" aria-pressed={focused} onClick={() => setFocused(!focused)}>
          {focused ? "RESTORE VIEW" : "FOCUS VIEW"}<span aria-hidden="true">{focused ? "↙" : "↗"}</span>
        </Button>
      </footer>
    </section>
  );
}
