import type { HandMirrorVisualState } from "./types";

const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function handFieldPolicy(hand: Pick<HandMirrorVisualState, "active" | "leftDetected" | "rightDetected" | "rightOpenness" | "rightPinch">) {
  const left = hand.active && hand.leftDetected;
  const right = hand.active && hand.rightDetected;
  const pulling = right && hand.rightPinch >= 0.46;
  const rightMode = !right ? "NEUTRAL" : pulling ? "PULL" : hand.rightOpenness <= 0.33 ? "GATHER" : hand.rightOpenness >= 0.62 ? "DISPERSE" : "NEUTRAL";
  return {
    rightMode,
    fieldMode: left && right ? "TIME_FILAMENT" : left ? "PUSH" : pulling ? "PULL" : rightMode === "GATHER" ? "GATHER" : rightMode === "DISPERSE" ? "DISPERSE" : "AMBIENT",
    coreWeight: right && !pulling ? clamp((0.33 - hand.rightOpenness) / 0.18) : 0,
    disperseWeight: right && !pulling ? clamp((hand.rightOpenness - 0.62) / 0.26) : 0,
    rightPullStrength: pulling ? 0.65 + clamp((hand.rightPinch - 0.46) / 0.54) * 0.4 : 0,
  } as const;
}
