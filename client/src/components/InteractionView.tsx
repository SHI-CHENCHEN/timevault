import { TIME_OPTIONS, type CanonicalAction, type InstallationSnapshot } from "@timevault/shared";
import { AccountSummary } from "./AccountSummary";
import { Button } from "./Button";
import { HistoryView } from "./HistoryView";
import { ReflectionView } from "./ReflectionView";
import { TimeSelector } from "./TimeSelector";
import { FragmentClock } from "./FragmentClock";
import { ConfirmationReceipt } from "./ConfirmationReceipt";
import { TransactionOutcome } from "./TransactionOutcome";
import { ActiveTime } from "./ActiveTime";
import type { HandTrackingController } from "../hooks/useHandTracking";

export function InteractionView({
  snapshot,
  dispatch,
  handMirror,
}: {
  snapshot: InstallationSnapshot;
  dispatch: (action: CanonicalAction) => void;
  handMirror: HandTrackingController;
}) {
  const { interaction, account } = snapshot;
  const modeLabel = interaction.currentMode === "SELL" ? "SELL TIME" : "BUY BACK";
  const selected = String(interaction.selectedMinutes).padStart(2, "0");

  if (interaction.currentScreen === "HISTORY") {
    return (
      <HistoryView
        snapshot={snapshot}
        onClose={() => dispatch({ type: "GO_IDLE" })}
        onReflect={() => dispatch({ type: "SHOW_REFLECTION" })}
      />
    );
  }

  if (interaction.currentScreen === "REFLECTION") {
    return <ReflectionView snapshot={snapshot} dispatch={dispatch} handMirror={handMirror} />;
  }

  if (interaction.currentScreen === "SETTINGS") {
    return (
      <section className="screen-layer settings-experience">
        <div className="state-caption"><span>DEVELOPMENT</span><i>09</i></div>
        <h1>INSTALLATION<br />PAUSED</h1>
        <p>The spatial system remains available to the simulator.</p>
        <Button variant="primary" onClick={() => dispatch({ type: "GO_IDLE" })}>RETURN</Button>
      </section>
    );
  }

  if (interaction.currentScreen === "MODE_SELECTION") {
    return (
      <section className="screen-layer mode-experience">
        <div className="state-caption"><span>TIME EXCHANGE</span><i>01 / 04</i></div>
        <h1>HOW SHOULD<br />TIME MOVE?</h1>
        <p className="state-note">Every exchange changes the same reserve structure.</p>
        <div className="mode-actions">
          <button onClick={() => dispatch({ type: "SELECT_MODE", value: "SELL" })}>
            <span>01 / STORE</span><strong>SELL TIME</strong><small>FRAGMENTS → RESERVE</small>
          </button>
          <button onClick={() => dispatch({ type: "SELECT_MODE", value: "BUY" })}>
            <span>02 / RECLAIM</span><strong>BUY BACK</strong><small>RESERVE → ACTIVE TIME</small>
          </button>
        </div>
        <Button variant="ghost" onClick={() => dispatch({ type: "CANCEL" })}>CANCEL</Button>
      </section>
    );
  }

  if (interaction.currentScreen === "TIME_SELECTION" && interaction.currentMode) {
    return (
      <section className={`screen-layer selection-experience selection-experience--${interaction.currentMode.toLowerCase()}`}>
        <div className="selection-copy">
          <div className="state-caption"><span>{modeLabel}</span><i>02 / 04</i></div>
          <h1>{interaction.currentMode === "SELL" ? "DEFINE THE\nFRAGMENT." : "SELECT TIME\nTO RECOVER."}</h1>
          <p>{interaction.currentMode === "SELL" ? "Loose time remains separate until confirmed." : `${account.timeReserve} minutes currently available.`}</p>
        </div>
        <div className="selection-readout" aria-live="polite">
          <strong>{selected}</strong><span>MIN</span>
          <small><b>{String(interaction.selectedMinutes / 5).padStart(2, "0")}</b> × 05 MIN FRAGMENTS</small>
        </div>
        <div className="selection-field" aria-label={`${interaction.selectedMinutes / 5} selected five-minute fragments`}>
          <span>FRAGMENT FIELD <i>0{TIME_OPTIONS.indexOf(interaction.selectedMinutes) + 1} / 05</i></span>
          <div className="selection-field__canvas"><FragmentClock minutes={interaction.selectedMinutes} /></div>
          <small>ONE UNIT = FIVE MINUTES</small>
        </div>
        <TimeSelector
          selected={interaction.selectedMinutes}
          reserve={account.timeReserve}
          mode={interaction.currentMode}
          dispatch={dispatch}
        />
        <div className="peripheral-actions">
          <Button variant="ghost" onClick={() => dispatch({ type: "CANCEL" })}>CANCEL</Button>
          <Button variant="primary" onClick={() => dispatch({ type: "CONFIRM_TRANSACTION" })}>CONTINUE</Button>
        </div>
      </section>
    );
  }

  if (interaction.currentScreen === "CONFIRMATION") {
    return <ConfirmationReceipt snapshot={snapshot} dispatch={dispatch} />;
  }

  if (["TRANSACTION_PROCESSING", "TRANSACTION_COMPLETE", "BUYBACK_COMPLETE"].includes(interaction.currentScreen)) {
    return <TransactionOutcome snapshot={snapshot} dispatch={dispatch} />;
  }

  if (interaction.currentScreen === "BUYBACK_COUNTDOWN") {
    return <ActiveTime snapshot={snapshot} />;
  }

  return (
    <section className="screen-layer idle-experience">
      <div className="idle-wordmark" aria-hidden="true"><span>TIME</span><span>VAULT</span></div>
      <div className="idle-statement">
        <span>PERSONAL TIME RESERVE</span>
        <h1>WHAT REMAINS<br />OF YOUR TIME?</h1>
        <p>FRAGMENTS GATHER. TIME BECOMES FORM.</p>
        <div className="idle-reserve-annotation">
          <span>RESERVE</span>
          <strong>{String(Math.floor(account.timeReserve / 60)).padStart(2, "0")}<i>H</i> {String(account.timeReserve % 60).padStart(2, "0")}<i>M</i></strong>
        </div>
      </div>
      <div className="idle-vessel-stage" aria-hidden="true" />
      <div className="idle-actions">
        <button onClick={() => dispatch({ type: "SELECT_MODE", value: "SELL" })}>
          <span>01 / STORE</span><strong>SELL TIME</strong><small>ADD FRAGMENTS</small>
        </button>
        <button onClick={() => dispatch({ type: "SELECT_MODE", value: "BUY" })}>
          <span>02 / RECLAIM</span><strong>BUY BACK</strong><small>RECOVER TIME</small>
        </button>
        <button className="history-trigger" onClick={() => dispatch({ type: "SHOW_HISTORY" })}><span>03 / ARCHIVE</span><strong>HISTORY</strong></button>
        <button className="reflection-trigger" onClick={() => dispatch({ type: "SHOW_REFLECTION" })}><span>04 / REFLECT</span><strong>REFLECTION</strong></button>
      </div>
      <AccountSummary account={account} />
    </section>
  );
}
