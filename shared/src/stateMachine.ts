import { TIME_OPTIONS } from "./constants";
import type { TimeOption } from "./constants";
import type { CanonicalAction, InteractionState, TransactionType } from "./types";

export const createInitialInteractionState = (): InteractionState => ({
  currentScreen: "IDLE",
  currentMode: null,
  selectedMinutes: 15,
  message: null,
  inputSources: [],
  lastTransactionId: null,
  reflectionStep: 0,
});

export function rotateDuration(current: TimeOption, direction: 1 | -1): TimeOption {
  const index = TIME_OPTIONS.indexOf(current);
  const next = (index + direction + TIME_OPTIONS.length) % TIME_OPTIONS.length;
  return TIME_OPTIONS[next];
}

export function withInputSource(
  state: InteractionState,
  source: "MOUSE" | "ARDUINO",
): InteractionState {
  if (state.inputSources.includes(source)) return state;
  return { ...state, inputSources: [...state.inputSources, source] };
}

export function interactionReducer(state: InteractionState, action: CanonicalAction): InteractionState {
  switch (action.type) {
    case "OPEN_MODE_SELECTION":
      if (state.currentScreen !== "IDLE") return state;
      return { ...createInitialInteractionState(), currentScreen: "MODE_SELECTION" };
    case "SELECT_MODE":
      if (!["IDLE", "MODE_SELECTION", "TIME_SELECTION"].includes(state.currentScreen)) return state;
      return {
        ...state,
        currentScreen: "TIME_SELECTION",
        currentMode: action.value,
        message: null,
        lastTransactionId: null,
      };
    case "SET_DURATION":
      if (state.currentScreen !== "TIME_SELECTION") return state;
      return { ...state, selectedMinutes: action.value, message: null };
    case "INCREASE_DURATION":
      if (state.currentScreen === "REFLECTION") {
        return { ...state, reflectionStep: ((state.reflectionStep + 1) % 3) as 0 | 1 | 2 };
      }
      if (state.currentScreen !== "TIME_SELECTION") return state;
      return { ...state, selectedMinutes: rotateDuration(state.selectedMinutes, 1), message: null };
    case "DECREASE_DURATION":
      if (state.currentScreen === "REFLECTION") {
        return { ...state, reflectionStep: ((state.reflectionStep + 2) % 3) as 0 | 1 | 2 };
      }
      if (state.currentScreen !== "TIME_SELECTION") return state;
      return { ...state, selectedMinutes: rotateDuration(state.selectedMinutes, -1), message: null };
    case "CONFIRM_TRANSACTION":
      if (state.currentScreen === "REFLECTION") {
        if (state.reflectionStep === 2) return createInitialInteractionState();
        return { ...state, reflectionStep: (state.reflectionStep + 1) as 1 | 2 };
      }
      if (state.currentScreen === "TIME_SELECTION") {
        return { ...state, currentScreen: "CONFIRMATION", message: null };
      }
      if (state.currentScreen === "CONFIRMATION") {
        return { ...state, currentScreen: "TRANSACTION_PROCESSING", message: null };
      }
      return state;
    case "CANCEL":
      if (["MODE_SELECTION", "TIME_SELECTION", "CONFIRMATION", "HISTORY", "REFLECTION"].includes(state.currentScreen)) {
        return createInitialInteractionState();
      }
      return state;
    case "GO_IDLE":
      return createInitialInteractionState();
    case "SHOW_HISTORY":
      if (state.currentScreen !== "IDLE") return state;
      return { ...state, currentScreen: "HISTORY", message: null };
    case "SHOW_REFLECTION":
      if (!["IDLE", "HISTORY"].includes(state.currentScreen)) return state;
      return { ...state, currentScreen: "REFLECTION", reflectionStep: 0, message: null };
    case "SET_REFLECTION_STEP":
      if (state.currentScreen !== "REFLECTION") return state;
      return { ...state, reflectionStep: action.value, message: null };
    case "SHOW_SETTINGS":
      if (state.currentScreen !== "IDLE") return state;
      return { ...state, currentScreen: "SETTINGS", message: null };
    case "COUNTDOWN_COMPLETE":
      if (state.currentScreen !== "BUYBACK_COUNTDOWN") return state;
      return { ...state, currentScreen: "BUYBACK_COMPLETE", message: "TIME RETURNED" };
    case "SET_DEMO_MODE":
    case "SET_DEMO_MULTIPLIER":
      return state;
    default:
      return state;
  }
}

export function transactionInputSource(state: InteractionState): "MOUSE" | "ARDUINO" | "MIXED" {
  if (state.inputSources.length > 1) return "MIXED";
  return state.inputSources[0] ?? "MOUSE";
}

export function isTransactionMode(value: unknown): value is TransactionType {
  return value === "SELL" || value === "BUY";
}

export function isTimeOption(value: unknown): value is TimeOption {
  return typeof value === "number" && TIME_OPTIONS.includes(value as TimeOption);
}
