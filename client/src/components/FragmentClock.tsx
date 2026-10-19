import type { CSSProperties } from "react";
import { clockFragmentCount, clockSlot } from "../visual/clockLayout";

export function FragmentClock({ minutes }: { minutes: number }) {
  const units = clockFragmentCount(minutes);
  return (
    <div className="fragment-clock" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <circle className="fragment-clock__outer" cx="200" cy="200" r="184" />
        <circle className="fragment-clock__inner" cx="200" cy="200" r="105" />
        {Array.from({ length: 60 }, (_, index) => {
          const angle = index * Math.PI / 30 - Math.PI / 2;
          const inner = index % 5 === 0 ? 167 : 175;
          return <line key={index} className={index < minutes ? "is-filled" : ""}
            x1={200 + Math.cos(angle) * inner} y1={200 + Math.sin(angle) * inner}
            x2={200 + Math.cos(angle) * 182} y2={200 + Math.sin(angle) * 182} />;
        })}
        {Array.from({ length: 12 }, (_, index) => {
          const { x, y } = clockSlot(index);
          return <circle key={index} className={index < units ? "fragment-clock__slot is-filled" : "fragment-clock__slot"}
            cx={200 + x * 144} cy={200 + y * 144} r="3" />;
        })}
        <path className="fragment-clock__sweep" d="M 200 200 L 200 84" />
      </svg>
      <div className="fragment-clock__center"><span>TIME IN FORM</span><b>{String(minutes).padStart(2, "0")}</b><small>OF 60 MINUTES</small></div>
      <div className="selection-field__fallback">
        {Array.from({ length: units }, (_, index) => {
          const { x, y } = clockSlot(index);
          return <i key={index} style={{ "--clock-x": `${50 + x * 36}%`, "--clock-y": `${50 + y * 36}%` } as CSSProperties}>05</i>;
        })}
      </div>
    </div>
  );
}
