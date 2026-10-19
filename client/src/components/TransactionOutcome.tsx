import { formatMinutes, type CanonicalAction, type InstallationSnapshot } from "@timevault/shared";
import { clockSlot } from "../visual/clockLayout";
import { Button } from "./Button";

/** Presentation only: completion and account values always come from the snapshot. */
export function TransactionOutcome({ snapshot, dispatch }: {
  snapshot: InstallationSnapshot;
  dispatch: (action: CanonicalAction) => void;
}) {
  const { interaction, account } = snapshot;
  const processing = interaction.currentScreen === "TRANSACTION_PROCESSING";
  const sell = interaction.currentMode === "SELL";
  const minutes = interaction.selectedMinutes;
  const units = minutes / 5;
  const label = processing ? "EXCHANGE IN PROGRESS" : sell ? "TIME STORED" : "RECOVERY COMPLETE";

  return (
    <section className={`screen-layer transaction-outcome ${processing ? "transaction-outcome--processing" : "transaction-outcome--complete"}`}
      aria-labelledby="outcome-title">
      <header className="outcome-heading">
        <span>{sell ? "STORE" : "RECLAIM"} / 04</span>
        <span className="outcome-status" role="status"><i aria-hidden="true" />{label}</span>
      </header>
      <div className="outcome-body">
        <div className="outcome-copy">
          <span className="outcome-eyebrow">{sell ? "FRAGMENTS → RESERVE" : "RESERVE → YOU"}</span>
          <h1 id="outcome-title">{processing
            ? sell ? <>Giving time<br />a place.</> : <>Opening<br />your reserve.</>
            : sell ? <>Small moments.<br />Now held.</> : <>Time is yours.<br />Again.</>}</h1>
          <p>{processing
            ? "The exchange is being processed. Your reserve updates when it is confirmed."
            : sell ? "What you noticed now has a place in your reserve."
              : "Recovered time is yours to spend with intention."}</p>
        </div>
        <div className="outcome-clock" aria-label={`${minutes} minutes ${processing ? "in exchange" : sell ? "stored" : "returned"}`}>
          <svg viewBox="0 0 360 360" aria-hidden="true">
            <circle className="outcome-clock__edge" cx="180" cy="180" r="164" />
            <circle className="outcome-clock__track" cx="180" cy="180" r="137" />
            {Array.from({ length: 60 }, (_, index) => {
              const angle = index / 60 * Math.PI * 2 - Math.PI / 2;
              const inner = index % 5 === 0 ? 151 : 157;
              return <line key={index} x1={180 + Math.cos(angle) * inner} y1={180 + Math.sin(angle) * inner}
                x2={180 + Math.cos(angle) * 163} y2={180 + Math.sin(angle) * 163} />;
            })}
            {Array.from({ length: 12 }, (_, index) => {
              const slot = clockSlot(index);
              return <circle key={index} className={`outcome-clock__unit ${index < units ? "is-filled" : ""}`}
                cx={180 + slot.x * 137} cy={180 + slot.y * 137} r="3.5" />;
            })}
            {processing ? <g className="outcome-clock__sweep"><line x1="180" y1="180" x2="180" y2="59" /><circle cx="180" cy="59" r="3" /></g> : null}
          </svg>
          <div className="outcome-clock__value">
            <span>{processing ? "IN EXCHANGE" : sell ? "ADDED TO RESERVE" : "RETURNED TO YOU"}</span>
            <strong>{String(minutes).padStart(2, "0")}</strong>
            <small>MINUTES</small>
          </div>
          <div className="outcome-clock__legend">{String(units).padStart(2, "0")} FIVE-MINUTE FRAGMENTS</div>
        </div>
      </div>
      <div className="outcome-account">
        <div><span>{processing ? "CURRENT RESERVE" : "RESERVE NOW"}</span><strong>{formatMinutes(account.timeReserve)}</strong></div>
        <div><span>{sell ? "TOTAL NOTICED" : "TOTAL RECOVERED"}</span><strong>{formatMinutes(sell ? account.totalSold : account.totalRecovered)}</strong></div>
        <div><span>ACTIVE FRAGMENTS</span><strong>{String(account.fragmentCount).padStart(2, "0")}</strong></div>
      </div>
      <footer className="outcome-footer">
        {processing ? <>
          <span className="outcome-process-note">PLEASE KEEP THIS WINDOW OPEN</span>
          <div className="outcome-steps" aria-hidden="true"><span>ALIGN</span><span>CONNECT</span><span>CONSOLIDATE</span></div>
        </> : <>
          <span>FRAGMENTS BECOME A LIFE.</span>
          <Button variant="primary" className="outcome-return" onClick={() => dispatch({ type: "GO_IDLE" })}>
            <span>RETURN TO THE VAULT<small>CONTINUE YOUR EXPLORATION</small></span><b aria-hidden="true">↗</b>
          </Button>
        </>}
      </footer>
    </section>
  );
}
