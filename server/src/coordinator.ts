import {
  createInitialInteractionState,
  interactionReducer,
  transactionInputSource,
  withInputSource,
} from "@timevault/shared";
import type {
  ArduinoFeedback,
  CanonicalAction,
  InstallationSnapshot,
  InteractionState,
  StorageState,
  TimeOption,
} from "@timevault/shared";
import { serverConfig } from "./config";
import { TimeVaultDatabase } from "./database";
import { SerialService } from "./serialService";

type EmitSnapshot = (snapshot: InstallationSnapshot) => void;

export class InstallationCoordinator {
  private interaction: InteractionState = createInitialInteractionState();
  private completionTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private emitSnapshot: EmitSnapshot = () => undefined;
  readonly serial: SerialService;

  constructor(
    readonly database: TimeVaultDatabase,
    private readonly storage: StorageState = { status: "PERSISTENT", error: null },
  ) {
    this.serial = new SerialService({
      configuredPort: serverConfig.serialPort,
      autoConnect: serverConfig.serialAutoConnect,
      onAction: (action) => this.dispatch(action, "ARDUINO"),
      onStateChange: () => this.broadcast(),
    });
  }

  async initialize(): Promise<void> {
    const countdown = this.database.getActiveCountdown();
    if (countdown) {
      const transaction = this.database.getTransaction(countdown.transactionId);
      if (countdown.remainingSeconds <= 0) {
        this.database.completeCountdown(countdown.transactionId);
        this.interaction = {
          ...createInitialInteractionState(),
          currentScreen: "BUYBACK_COMPLETE",
          currentMode: "BUY",
          selectedMinutes: (transaction?.minutes ?? 15) as TimeOption,
          message: "TIME RETURNED",
          lastTransactionId: countdown.transactionId,
        };
        this.scheduleIdle();
      } else {
        this.interaction = {
          ...createInitialInteractionState(),
          currentScreen: "BUYBACK_COUNTDOWN",
          currentMode: "BUY",
          selectedMinutes: (transaction?.minutes ?? 15) as TimeOption,
          lastTransactionId: countdown.transactionId,
        };
        this.startCountdownTicker();
      }
    }
    await this.serial.initialize();
  }

  setEmitter(emitter: EmitSnapshot): void {
    this.emitSnapshot = emitter;
  }

  dispatch(action: CanonicalAction, source: "MOUSE" | "ARDUINO"): void {
    if (action.type === "SET_DEMO_MODE") {
      this.database.setSetting("demoMode", action.value);
      this.broadcast();
      return;
    }
    if (action.type === "SET_DEMO_MULTIPLIER") {
      this.database.setSetting("demoTimeMultiplier", Math.max(1, Math.min(600, action.value)));
      this.broadcast();
      return;
    }

    const sourceBearing = [
      "SELECT_MODE",
      "SET_DURATION",
      "INCREASE_DURATION",
      "DECREASE_DURATION",
      "CONFIRM_TRANSACTION",
    ].includes(action.type);
    const before = sourceBearing ? withInputSource(this.interaction, source) : this.interaction;

    if (
      action.type === "CONFIRM_TRANSACTION" &&
      before.currentScreen === "CONFIRMATION" &&
      before.currentMode === "BUY" &&
      this.database.getAccount().timeReserve < before.selectedMinutes
    ) {
      this.interaction = { ...before, message: "INSUFFICIENT TIME RESERVE" };
      this.broadcast();
      return;
    }

    const next = interactionReducer(before, action);
    if (next === this.interaction) return;
    this.interaction = next;

    if (["SELECT_MODE", "SET_DURATION", "INCREASE_DURATION", "DECREASE_DURATION"].includes(action.type)) {
      this.feedback({ type: "feedback", state: "SELECT", minutes: this.interaction.selectedMinutes });
    }
    if (action.type === "CANCEL") this.feedback({ type: "feedback", state: "CANCELLED" });

    this.broadcast();
    if (next.currentScreen === "TRANSACTION_PROCESSING") this.processTransaction();
  }

  getSnapshot(): InstallationSnapshot {
    return {
      interaction: this.interaction,
      account: this.database.getAccount(),
      composition: this.database.getComposition(),
      countdown: this.database.getActiveCountdown(),
      settings: this.database.getSettings(serverConfig.exhibitionMode),
      hardware: this.serial.getState(),
      storage: this.storage,
      history: this.database.getHistory(),
      todayFragmentedMinutes: this.database.getTodayFragmentedMinutes(),
      serverTime: new Date().toISOString(),
    };
  }

  broadcast(): void {
    this.emitSnapshot(this.getSnapshot());
  }

  addTestReserve(minutes: number): void {
    if (minutes <= 0 || minutes % 5 !== 0) return;
    const settings = this.database.getSettings(serverConfig.exhibitionMode);
    this.database.sell(minutes, "ARDUINO", settings.demoMode);
    this.broadcast();
  }

  resetDatabase(): void {
    this.clearTimers();
    this.database.reset();
    this.interaction = createInitialInteractionState();
    this.broadcast();
  }

  shutdown(): void {
    this.clearTimers();
    void this.serial.disconnect();
    this.database.close();
  }

  private processTransaction(): void {
    const { currentMode, selectedMinutes } = this.interaction;
    if (!currentMode) return;
    const inputSource = transactionInputSource(this.interaction);
    const settings = this.database.getSettings(serverConfig.exhibitionMode);

    this.feedback({
      type: "feedback",
      state: currentMode === "SELL" ? "SELL_PROCESSING" : "BUY_PROCESSING",
      minutes: selectedMinutes,
    });

    setTimeout(() => {
      try {
        if (currentMode === "SELL") {
          const transaction = this.database.sell(selectedMinutes, inputSource, settings.demoMode);
          this.interaction = {
            ...this.interaction,
            currentScreen: "TRANSACTION_COMPLETE",
            message: "TIME STORED",
            lastTransactionId: transaction.id,
          };
          this.feedback({ type: "feedback", state: "SELL_COMPLETE", minutes: selectedMinutes });
          this.scheduleIdle();
        } else {
          const transaction = this.database.buy(selectedMinutes, inputSource, settings);
          this.interaction = {
            ...this.interaction,
            currentScreen: "BUYBACK_COUNTDOWN",
            message: null,
            lastTransactionId: transaction.id,
          };
          this.feedback({ type: "feedback", state: "BUY_COUNTDOWN", minutes: selectedMinutes });
          this.startCountdownTicker();
        }
      } catch (error) {
        this.interaction = {
          ...this.interaction,
          currentScreen: "CONFIRMATION",
          message: error instanceof Error ? error.message : "TRANSACTION UNAVAILABLE",
        };
      }
      this.broadcast();
    }, serverConfig.processingHoldMs);
  }

  private startCountdownTicker(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      const countdown = this.database.getActiveCountdown();
      if (!countdown) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        return;
      }
      if (countdown.remainingSeconds <= 0) {
        this.database.completeCountdown(countdown.transactionId);
        this.interaction = interactionReducer(this.interaction, { type: "COUNTDOWN_COMPLETE" });
        this.feedback({ type: "feedback", state: "BUY_COMPLETE" });
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.scheduleIdle();
      }
      this.broadcast();
    }, 250);
  }

  private scheduleIdle(): void {
    if (this.completionTimer) clearTimeout(this.completionTimer);
    this.completionTimer = setTimeout(() => {
      this.interaction = createInitialInteractionState();
      this.completionTimer = null;
      this.broadcast();
    }, serverConfig.completionHoldMs);
  }

  private feedback(feedback: ArduinoFeedback): void {
    this.serial.sendFeedback(feedback);
  }

  private clearTimers(): void {
    if (this.completionTimer) clearTimeout(this.completionTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.completionTimer = null;
    this.countdownTimer = null;
  }
}
