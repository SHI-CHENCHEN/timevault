import { formatMinutes, type CanonicalAction, type InstallationSnapshot } from "@timevault/shared";
import { clockSlot } from "../visual/clockLayout";
import { transactionPreview } from "../visual/transactionPreview";
import { Button } from "./Button";

export function ConfirmationReceipt({ snapshot, dispatch }: {
  snapshot: InstallationSnapshot;
  dispatch: (action: CanonicalAction) => void;
}) {
  const { interaction, account } = snapshot;
  const sell = interaction.currentMode === "SELL";
  const preview = transactionPreview(account.timeReserve, interaction.selectedMinutes, sell ? "SELL" : "BUY");
  return (
    <section className={`screen-layer confirmation-experience exchange-receipt exchange-receipt--${sell ? "sell" : "buy"}`} aria-labelledby="receipt-title">
      <div className="receipt-heading">
        <div className="state-caption"><span>CONFIRM TRANSACTION</span><i>03 / 04</i></div>
        <span className="receipt-reference">TIME EXCHANGE / {sell ? "STORE" : "RECLAIM"}</span>
      </div>
      <div className="receipt-body">
        <div className="receipt-copy">
          <span className="receipt-direction">{preview.direction}</span>
          <h1 id="receipt-title">{sell ? <>Give time<br />a place.</> : <>Make time<br />yours again.</>}</h1>
          <div className="receipt-duration" aria-label={`${interaction.selectedMinutes} minutes`}>
            <strong>{String(interaction.selectedMinutes).padStart(2, "0")}</strong><span>MINUTES</span>
          </div>
          <p className="receipt-note">THE VAULT WILL {sell ? "ABSORB" : "RELEASE"} THIS TIME.</p>
        </div>
        <div className="receipt-dial" aria-label={`${preview.units} five-minute fragments`}>
          <svg viewBox="0 0 320 320" aria-hidden="true">
            <circle className="receipt-dial__edge" cx="160" cy="160" r="146" />
            <circle className="receipt-dial__track" cx="160" cy="160" r="119" />
            <circle className="receipt-dial__amount" cx="160" cy="160" r="119" pathLength="60"
              strokeDasharray={`${interaction.selectedMinutes} 60`} transform="rotate(-90 160 160)" />
            {Array.from({ length: 60 }, (_, index) => {
              const angle = index / 60 * Math.PI * 2 - Math.PI / 2;
              const inner = index % 5 === 0 ? 132 : 138;
              return <line key={index} x1={160 + Math.cos(angle) * inner} y1={160 + Math.sin(angle) * inner}
                x2={160 + Math.cos(angle) * 144} y2={160 + Math.sin(angle) * 144} />;
            })}
            {Array.from({ length: 12 }, (_, index) => {
              const slot = clockSlot(index);
              return <circle key={index} className={`receipt-dial__unit ${index < preview.units ? "is-filled" : ""}`}
                cx={160 + slot.x * 119} cy={160 + slot.y * 119} r="4" />;
            })}
          </svg>
          <div className="receipt-dial__center"><span>FIVE-MINUTE UNITS</span><strong>{String(preview.units).padStart(2, "0")}</strong><small>ONE HOUR / TWELVE FRAGMENTS</small></div>
          <span className="receipt-dial__legend">{sell ? "FRAGMENTS → RESERVE" : "RESERVE → ACTIVE TIME"}</span>
        </div>
      </div>
      <div className="receipt-balance" aria-label="Reserve preview">
        <div><span>CURRENT RESERVE</span><strong>{formatMinutes(preview.before)}</strong></div>
        <i aria-hidden="true">→</i>
        <div><span>AFTER CONFIRMATION</span><strong>{preview.available ? formatMinutes(preview.after) : "—"}</strong></div>
        <small>PREVIEW ONLY<br /> NOT YET EXCHANGED</small>
      </div>
      {interaction.message ? <p className="receipt-message" role="alert">{interaction.message}</p> : null}
      <div className="receipt-footer">
        <p>Only your confirmation<br /> moves this time.</p>
        <div className="confirm-actions">
          <Button variant="ghost" className="receipt-cancel" onClick={() => dispatch({ type: "CANCEL" })}>CANCEL</Button>
          <Button variant="primary" className="confirm-target receipt-confirm" onClick={() => dispatch({ type: "CONFIRM_TRANSACTION" })}>
            <span>CONFIRM<i>{sell ? "STORE TIME" : "RECLAIM TIME"} / HARDWARE OR CLICK</i></span><b aria-hidden="true">↗</b>
          </Button>
        </div>
      </div>
    </section>
  );
}
