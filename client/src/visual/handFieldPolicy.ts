import type { HandMirrorVisualState } from "./types";

const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function handFieldPolicy(hand: Pick<HandMirrorVisualState, "active" | "leftDetected" | "rightDetected" | "rightOpenness" | "rightPinch">) {
  const left = hand.active && hand.leftDetected;
  const right = hand.active && hand.rightDetected;
  // A fist also brings thumb and index together. Pinch needs the other fingers
  // sufficiently open so a closed right hand consistently means GATHER.
  const pulling = right && hand.rightPinch >= 0.56 && hand.rightOpenness > 0.38;
  const rightMode = !right ? "NEUTRAL" : pulling ? "PULL" : hand.rightOpenness <= 0.33 ? "GATHER" : hand.rightOpenness >= 0.62 ? "DISPERSE" : "NEUTRAL";
  return {
    rightMode,
    filamentActive: left && right && (rightMode === "NEUTRAL" || rightMode === "PULL"),
    fieldMode: left && right && (rightMode === "NEUTRAL" || rightMode === "PULL") ? "TIME_FILAMENT" : pulling ? "PULL" : rightMode === "GATHER" ? "GATHER" : rightMode === "DISPERSE" ? "DISPERSE" : left ? "PUSH" : "AMBIENT",
    coreWeight: right && !pulling ? clamp((0.33 - hand.rightOpenness) / 0.18) : 0,
    disperseWeight: right && !pulling ? clamp((hand.rightOpenness - 0.62) / 0.26) : 0,
    rightPullStrength: pulling ? 0.65 + clamp((hand.rightPinch - 0.46) / 0.54) * 0.4 : 0,
  } as const;
}
