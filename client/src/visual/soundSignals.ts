import type { InteractionScreen } from "@timevault/shared";

export type TimeVaultSoundSignal =
  | "SELECTION"
  | "FRAGMENT_CONNECT"
  | "TRANSACTION_RESONANCE"
  | "COUNTDOWN_COMPLETE";

/**
 * Sound remains disabled. Future audio code can listen for this event without
 * coupling sound playback to the interaction state machine.
 */
export function emitSoundSignal(screen: InteractionScreen, previous: InteractionScreen | null): void {
  let signal: TimeVaultSoundSignal | null = null;
  if (screen === "TIME_SELECTION" && previous !== "TIME_SELECTION") signal = "SELECTION";
  if (screen === "TRANSACTION_PROCESSING") signal = "FRAGMENT_CONNECT";
  if (screen === "TRANSACTION_COMPLETE") signal = "TRANSACTION_RESONANCE";
  if (screen === "BUYBACK_COMPLETE") signal = "COUNTDOWN_COMPLETE";
  if (signal) window.dispatchEvent(new CustomEvent<TimeVaultSoundSignal>("timevault:sound", { detail: signal }));
}
