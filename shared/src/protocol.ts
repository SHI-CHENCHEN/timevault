import { isTransactionMode } from "./stateMachine";
import type { ArduinoMessage, CanonicalAction } from "./types";

export function parseArduinoLine(line: string): ArduinoMessage | null {
  try {
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== "object" || !("type" in value)) return null;
    const message = value as Record<string, unknown>;
    if (message.type === "connected") return { type: "connected", device: String(message.device ?? "UNKNOWN") };
    if (message.type === "mode" && isTransactionMode(message.value)) {
      return { type: "mode", value: message.value };
    }
    if (message.type === "encoder" && (message.direction === "CW" || message.direction === "CCW")) {
      return { type: "encoder", direction: message.direction };
    }
    if (message.type === "confirm") return { type: "confirm" };
    if (message.type === "cancel") return { type: "cancel" };
    return null;
  } catch {
    return null;
  }
}

export function arduinoMessageToAction(message: ArduinoMessage): CanonicalAction | null {
  switch (message.type) {
    case "mode":
      return message.value ? { type: "SELECT_MODE", value: message.value } : null;
    case "encoder":
      return message.direction === "CW" ? { type: "INCREASE_DURATION" } : { type: "DECREASE_DURATION" };
    case "confirm":
      return { type: "CONFIRM_TRANSACTION" };
    case "cancel":
      return { type: "CANCEL" };
    default:
      return null;
  }
}
