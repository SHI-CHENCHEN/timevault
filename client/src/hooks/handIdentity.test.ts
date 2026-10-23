import { describe, expect, it } from "vitest";
import { HandIdentityTracker } from "./handIdentity";
const hand = (side: "LEFT" | "RIGHT", x: number, id: number, score = 0.95) => ({ side, x, y: 0.5, id, score });

describe("continuous physical hand identity", () => {
  it("uses physical model labels even on the opposite screen half", () => {
    const tracker = new HandIdentityTracker();
    expect(tracker.resolve([hand("LEFT", 0.8, 1), hand("RIGHT", 0.2, 2)], 0).map(h => [h.id, h.side]))
      .toEqual([[1, "LEFT"], [2, "RIGHT"]]);
  });
  it("keeps roles when both model labels briefly swap", () => {
    const tracker = new HandIdentityTracker();
    tracker.resolve([hand("LEFT", 0.25, 1), hand("RIGHT", 0.75, 2)], 0);
    expect(tracker.resolve([hand("RIGHT", 0.27, 1), hand("LEFT", 0.73, 2)], 80).map(h => [h.id, h.side]))
      .toEqual([[1, "LEFT"], [2, "RIGHT"]]);
  });
  it("does not drop one tracked hand when both are briefly labeled right", () => {
    const tracker = new HandIdentityTracker();
    tracker.resolve([hand("LEFT", 0.25, 1), hand("RIGHT", 0.75, 2)], 0);
    expect(tracker.resolve([hand("RIGHT", 0.28, 1), hand("RIGHT", 0.72, 2)], 100).map(h => h.side))
      .toEqual(["LEFT", "RIGHT"]);
  });
  it("retains a single moving hand through a short classification glitch", () => {
    const tracker = new HandIdentityTracker();
    tracker.resolve([hand("LEFT", 0.3, 1)], 0);
    expect(tracker.resolve([hand("RIGHT", 0.4, 1)], 100)[0].side).toBe("LEFT");
  });
  it("follows predicted motion through a crossing instead of swapping screen halves", () => {
    const tracker = new HandIdentityTracker();
    tracker.resolve([hand("LEFT", 0.35, 1), hand("RIGHT", 0.65, 2)], 0);
    tracker.resolve([hand("LEFT", 0.45, 1), hand("RIGHT", 0.55, 2)], 100);
    const result = tracker.resolve([hand("RIGHT", 0.52, 1), hand("LEFT", 0.48, 2)], 200);
    expect(result.map(h => [h.id, h.side])).toEqual([[1, "LEFT"], [2, "RIGHT"]]);
  });
  it("expires lost identities and clears ownership on Stop", () => {
    const tracker = new HandIdentityTracker();
    tracker.resolve([hand("LEFT", 0.3, 1)], 0);
    expect(tracker.resolve([hand("RIGHT", 0.3, 2)], 800)[0].side).toBe("RIGHT");
    tracker.clear();
    expect(tracker.resolve([hand("LEFT", 0.3, 3)], 900)[0].side).toBe("LEFT");
  });
});
