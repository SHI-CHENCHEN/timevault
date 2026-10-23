import { describe, expect, it } from "vitest";
import { handFieldPolicy } from "./handFieldPolicy";
import { createHandMirrorVisualState } from "./types";

function hand(patch: Partial<ReturnType<typeof createHandMirrorVisualState>> = {}) {
  return { ...createHandMirrorVisualState(), active: true, ...patch };
}
describe("physical hand roles", () => {
  it("keeps left-only input in chapter/push mode, regardless of stale right signals", () => {
    const policy = handFieldPolicy(hand({ leftDetected: true, rightOpenness: 0, rightPinch: 1 }));
    expect(policy.fieldMode).toBe("PUSH");
    expect(policy.rightMode).toBe("NEUTRAL");
    expect(policy.coreWeight + policy.disperseWeight + policy.rightPullStrength).toBe(0);
  });
  it("does not give a neutral right palm the left-palm push or pull effect", () => {
    const policy = handFieldPolicy(hand({ rightDetected: true, rightOpenness: 0.48 }));
    expect(policy.rightMode).toBe("NEUTRAL");
    expect(policy.fieldMode).toBe("AMBIENT");
    expect(policy.rightPullStrength).toBe(0);
  });
  it("separates right open-palm dispersion from right fist gathering", () => {
    const open = handFieldPolicy(hand({ rightDetected: true, rightOpenness: 1 }));
    const fist = handFieldPolicy(hand({ rightDetected: true, rightOpenness: 0 }));
    expect(open.rightMode).toBe("DISPERSE");
    expect(open.fieldMode).toBe("DISPERSE");
    expect(open.disperseWeight).toBe(1);
    expect(open.coreWeight).toBe(0);
    expect(fist.rightMode).toBe("GATHER");
    expect(fist.fieldMode).toBe("GATHER");
    expect(fist.coreWeight).toBe(1);
    expect(fist.disperseWeight).toBe(0);
    expect(open.rightPullStrength + fist.rightPullStrength).toBe(0);
  });
  it("prioritizes right pinch attraction over whole-field shape changes", () => {
    const policy = handFieldPolicy(hand({ rightDetected: true, rightPinch: 0.9, rightOpenness: 0.8 }));
    expect(policy.fieldMode).toBe("PULL");
    expect(policy.rightMode).toBe("PULL");
    expect(policy.rightPullStrength).toBeGreaterThan(0);
    expect(policy.disperseWeight + policy.coreWeight).toBe(0);
  });
  it("retains the dual-hand filament while keeping right pinch independent", () => {
    const policy = handFieldPolicy(hand({ leftDetected: true, rightDetected: true, rightPinch: 1 }));
    expect(policy.fieldMode).toBe("TIME_FILAMENT");
    expect(policy.rightMode).toBe("PULL");
  });
  it("uses the same neutral interval for the status and particle shape", () => {
    for (const openness of [0.34, 0.43, 0.48, 0.54, 0.61]) {
      const policy = handFieldPolicy(hand({ rightDetected: true, rightOpenness: openness }));
      expect(policy.rightMode).toBe("NEUTRAL");
      expect(policy.disperseWeight + policy.coreWeight).toBe(0);
    }
  });
  it("does not mistake a fist with adjacent thumb/index tips for a pinch", () => {
    const policy = handFieldPolicy(hand({ rightDetected: true, rightOpenness: 0.1, rightPinch: 1 }));
    expect(policy.rightMode).toBe("GATHER");
    expect(policy.rightPullStrength).toBe(0);
  });
  it("lets deliberate right-hand shapes take priority over the two-hand filament", () => {
    const open = handFieldPolicy(hand({ leftDetected: true, rightDetected: true, rightOpenness: 1 }));
    expect(open.fieldMode).toBe("DISPERSE"); expect(open.filamentActive).toBe(false);
    const fist = handFieldPolicy(hand({ leftDetected: true, rightDetected: true, rightOpenness: 0 }));
    expect(fist.fieldMode).toBe("GATHER"); expect(fist.filamentActive).toBe(false);
  });
  it("ignores all right-hand effects after camera stop", () => {
    const policy = handFieldPolicy(hand({ active: false, leftDetected: true, rightDetected: true, rightPinch: 1, rightOpenness: 0 }));
    expect(policy.fieldMode).toBe("AMBIENT");
    expect(policy.rightMode).toBe("NEUTRAL");
    expect(policy.coreWeight + policy.disperseWeight + policy.rightPullStrength).toBe(0);
  });
});
