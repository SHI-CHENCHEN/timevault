import { describe, expect, it } from "vitest";
import {
  arduinoMessageToAction,
  createInitialInteractionState,
  interactionReducer,
  parseArduinoLine,
  transactionInputSource,
  withInputSource,
} from "./index";

describe("canonical interaction state machine", () => {
  it("moves deterministically through a sell confirmation", () => {
    let state = createInitialInteractionState();
    state = interactionReducer(state, { type: "OPEN_MODE_SELECTION" });
    expect(state.currentScreen).toBe("MODE_SELECTION");
    state = interactionReducer(state, { type: "SELECT_MODE", value: "SELL" });
    state = interactionReducer(state, { type: "SET_DURATION", value: 5 });
    state = interactionReducer(state, { type: "CONFIRM_TRANSACTION" });
    expect(state.currentScreen).toBe("CONFIRMATION");
    state = interactionReducer(state, { type: "CONFIRM_TRANSACTION" });
    expect(state.currentScreen).toBe("TRANSACTION_PROCESSING");
  });

  it("translates Arduino JSON into the same canonical action", () => {
    const message = parseArduinoLine('{"type":"mode","value":"SELL"}');
    expect(message).not.toBeNull();
    expect(arduinoMessageToAction(message!)).toEqual({ type: "SELECT_MODE", value: "SELL" });
    expect(parseArduinoLine("not-json")).toBeNull();
  });

  it("records mixed control when Arduino and mouse share a session", () => {
    let state = withInputSource(createInitialInteractionState(), "ARDUINO");
    state = withInputSource(state, "MOUSE");
    expect(transactionInputSource(state)).toBe("MIXED");
  });

  it("places reflection after history and allows a clean return", () => {
    let state = interactionReducer(createInitialInteractionState(), { type: "SHOW_HISTORY" });
    expect(state.currentScreen).toBe("HISTORY");
    state = interactionReducer(state, { type: "SHOW_REFLECTION" });
    expect(state.currentScreen).toBe("REFLECTION");
    state = interactionReducer(state, { type: "INCREASE_DURATION" });
    expect(state.reflectionStep).toBe(1);
    state = interactionReducer(state, { type: "CONFIRM_TRANSACTION" });
    expect(state.reflectionStep).toBe(2);
    state = interactionReducer(state, { type: "CANCEL" });
    expect(state.currentScreen).toBe("IDLE");
  });
});
