import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { TIME_OPTIONS, type CanonicalAction, type TimeOption } from "@timevault/shared";

export function TimeSelector({
  selected,
  reserve,
  mode,
  dispatch,
}: {
  selected: TimeOption;
  reserve: number;
  mode: "SELL" | "BUY";
  dispatch: (action: CanonicalAction) => void;
}) {
  const lastWheelAt = useRef(0);
  const drag = useRef<{ pointerId: number; originX: number; originIndex: number; emittedIndex: number } | null>(null);
  const adjust = (direction: 1 | -1) => dispatch({ type: direction > 0 ? "INCREASE_DURATION" : "DECREASE_DURATION" });
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (Math.abs(event.deltaY) < 8 || now - lastWheelAt.current < 180) return;
    lastWheelAt.current = now;
    adjust(event.deltaY > 0 ? 1 : -1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") adjust(1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") adjust(-1);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const index = TIME_OPTIONS.indexOf(selected);
    drag.current = { pointerId: event.pointerId, originX: event.clientX, originIndex: index, emittedIndex: index };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const delta = Math.round((event.clientX - drag.current.originX) / 68);
    const nextIndex = Math.max(0, Math.min(TIME_OPTIONS.length - 1, drag.current.originIndex + delta));
    if (nextIndex === drag.current.emittedIndex) return;
    drag.current.emittedIndex = nextIndex;
    dispatch({ type: "SET_DURATION", value: TIME_OPTIONS[nextIndex] });
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  return (
    <div
      className="time-selector"
      tabIndex={0}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      aria-label="Select duration"
    >
      <button className="selector-step selector-step--previous" aria-label="Previous duration" onClick={() => adjust(-1)}>PREVIOUS</button>
      <div className="time-options" role="listbox" aria-label="Duration">
        {TIME_OPTIONS.map((minutes, index) => {
          const exceedsReserve = mode === "BUY" && minutes > reserve;
          return (
            <button
              key={minutes}
              className={`time-option ${selected === minutes ? "is-selected" : ""} ${exceedsReserve ? "is-unavailable" : ""}`}
              style={{ "--option-index": index } as CSSProperties}
              aria-selected={selected === minutes}
              aria-label={`${minutes} minutes${exceedsReserve ? ", exceeds reserve" : ""}`}
              onClick={() => dispatch({ type: "SET_DURATION", value: minutes })}
            >
              <strong>{String(minutes).padStart(2, "0")}</strong>
              <span>MIN</span>
            </button>
          );
        })}
      </div>
      <button className="selector-step selector-step--next" aria-label="Next duration" onClick={() => adjust(1)}>NEXT</button>
      <span className="selector-instruction">SCROLL / DRAG / ROTARY ENCODER</span>
    </div>
  );
}
