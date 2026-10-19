import { useRef, useState, type CSSProperties, type KeyboardEvent, type WheelEvent } from "react";
import { formatMinutes, type InstallationSnapshot, type TransactionType } from "@timevault/shared";
import { Button } from "./Button";
import { clockSlot } from "../visual/clockLayout";

export function HistoryView({
  snapshot,
  onClose,
  onReflect,
}: {
  snapshot: InstallationSnapshot;
  onClose: () => void;
  onReflect: () => void;
}) {
  const [filter, setFilter] = useState<"ALL" | TransactionType>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wheelAt = useRef(0);
  const records = snapshot.history.filter((record) => filter === "ALL" || record.type === filter);
  const selected = records.find((record) => record.id === selectedId) ?? records[0] ?? null;
  const selectedIndex = Math.max(0, records.findIndex((record) => record.id === selected?.id));
  const windowStart = Math.floor(selectedIndex / 12) * 12;
  const orbitRecords = records.slice(windowStart, windowStart + 12);
  const move = (direction: number) => {
    if (!records.length) return;
    const index = Math.max(0, Math.min(records.length - 1, selectedIndex + direction));
    setSelectedId(records[index].id);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    move(event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (Math.abs(event.deltaY) < 12 || now - wheelAt.current < 200) return;
    wheelAt.current = now;
    move(event.deltaY > 0 ? 1 : -1);
  };
  const recordTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="screen-layer history-experience history-experience--atlas">
      <header className="history-heading">
        <div>
          <div className="state-caption"><span>TIME RECORD</span><i>08</i></div>
          <h1>FRAGMENTS<br />BECOME FORM.</h1>
        </div>
        <div className="history-heading__actions">
          <Button variant="ghost" onClick={onClose}>RETURN</Button>
          <Button variant="primary" onClick={onReflect}>CONTINUE TO REFLECTION</Button>
        </div>
      </header>

      <div className="archive-introduction">
        <span>AN ATLAS OF YOUR TIME</span>
        <p>Every interval leaves a trace.<br />Turn through the moments you noticed.</p>
        <div className="archive-reserve"><small>CURRENT RESERVE</small><strong>{formatMinutes(snapshot.account.timeReserve)}</strong></div>
        <div className="archive-legend"><i />STORED <i />RECLAIMED</div>
      </div>

      <div className="archive-orbit">
        <div className="archive-dial" tabIndex={0} role="group" aria-label="Explore time records with arrow keys or wheel" onKeyDown={onKeyDown} onWheel={onWheel}>
          <svg viewBox="0 0 500 500" aria-hidden="true">
            <circle cx="250" cy="250" r="212" />
            <circle cx="250" cy="250" r="174" />
            {Array.from({ length: 60 }, (_, index) => {
              const angle = index * Math.PI / 30;
              const inner = index % 5 === 0 ? 222 : 228;
              return <line key={index} x1={250 + Math.sin(angle) * inner} y1={250 - Math.cos(angle) * inner}
                x2={250 + Math.sin(angle) * 235} y2={250 - Math.cos(angle) * 235} />;
            })}
          </svg>
          {orbitRecords.map((transaction, index) => {
            const slot = clockSlot(index, orbitRecords.length);
            return <button key={transaction.id}
              className={`archive-node archive-node--${transaction.type.toLowerCase()} ${transaction.id === selected?.id ? "is-active" : ""}`}
              style={{ "--node-x": `${50 + slot.x * 42.4}%`, "--node-y": `${50 + slot.y * 42.4}%` } as CSSProperties}
              aria-label={`${transaction.type === "SELL" ? "Stored" : "Recovered"} ${transaction.minutes} minutes at ${recordTime(transaction.timestamp)}`}
              aria-pressed={transaction.id === selected?.id}
              onClick={() => setSelectedId(transaction.id)}><i /><span>{String(windowStart + index + 1).padStart(2, "0")}</span></button>;
          })}
          <div className="archive-memory" aria-live="polite">
            {selected ? <>
              <time dateTime={selected.timestamp}>{recordTime(selected.timestamp)}</time>
              <span>{selected.type === "SELL" ? "TIME NOTICED" : "TIME RECLAIMED"}</span>
              <strong>{selected.type === "SELL" ? "+" : "−"}{String(selected.minutes).padStart(2, "0")}<small>MIN</small></strong>
              <p>{formatMinutes(selected.timeReserveBefore)}<i>→</i>{formatMinutes(selected.timeReserveAfter)}</p>
              <small>{selected.status === "COUNTDOWN" ? "PROTECTED TIME IN PROGRESS" : `${selected.minutes / 5} FIVE-MINUTE FRAGMENTS`}</small>
            </> : <p className="empty-state">NO TIME EXCHANGES RECORDED</p>}
          </div>
        </div>
        <div className="archive-scrubber">
          <button aria-label="Previous time record" onClick={() => move(-1)} disabled={!records.length || selectedIndex === 0}>←</button>
          <input aria-label="Explore transaction history" type="range" min="0" max={Math.max(0, records.length - 1)} value={selectedIndex}
            disabled={records.length < 2} onChange={(event) => setSelectedId(records[Number(event.currentTarget.value)].id)} />
          <button aria-label="Next time record" onClick={() => move(1)} disabled={!records.length || selectedIndex === records.length - 1}>→</button>
          <span>{records.length ? String(selectedIndex + 1).padStart(2, "0") : "00"} / {String(records.length).padStart(2, "0")} MOMENTS</span>
        </div>
      </div>

      <div className="archive-records">
        <div className="archive-filters" aria-label="Filter time records">
          {(["ALL", "SELL", "BUY"] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "ALL" ? "ALL MOMENTS" : value === "SELL" ? "STORED" : "RECLAIMED"}</button>)}
        </div>
        <div className="archive-list" aria-label="Transaction history">
          {records.map((transaction, index) => <button key={transaction.id} className={`archive-record ${transaction.id === selected?.id ? "is-active" : ""}`}
            aria-pressed={transaction.id === selected?.id} onClick={() => setSelectedId(transaction.id)}>
            <small>{String(index + 1).padStart(2, "0")}</small><time>{recordTime(transaction.timestamp)}</time>
            <span>{transaction.type === "SELL" ? "SELL" : "BUY BACK"}</span><strong>{transaction.type === "SELL" ? "+" : "−"}{transaction.minutes}<i>MIN</i></strong>
          </button>)}
          {!records.length ? <p className="empty-state">NO {filter === "ALL" ? "TIME EXCHANGES" : filter === "SELL" ? "STORED MOMENTS" : "RECOVERED MOMENTS"} RECORDED</p> : null}
        </div>
      </div>

      <div className="history-totals">
        <div><span>TODAY&apos;S FRAGMENTED TIME</span><strong>{formatMinutes(snapshot.todayFragmentedMinutes)}</strong></div>
        <div><span>TOTAL ACCUMULATED</span><strong>{formatMinutes(snapshot.account.totalSold)}</strong></div>
        <div><span>TOTAL RECOVERED</span><strong>{formatMinutes(snapshot.account.totalRecovered)}</strong></div>
      </div>
    </section>
  );
}
