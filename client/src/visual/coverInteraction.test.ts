import { describe, expect, it } from "vitest";
import { advanceCoverInertia, clampCoverTilt, coverCharge, coverGlassRadius, createCoverControlState, releaseCoverCharge } from "./coverInteraction";

describe("cover-only vessel exploration", () => {
  it("starts without changing any account or gesture state", () => {
    const state = createCoverControlState();
    expect(state.flowDirection).toBe(1);
    expect(state.flowPaused).toBe(false);
    expect(state.pressed).toBe(false);
    expect(Object.keys(state)).not.toContain("reserve");
  });
  it("charges only a stationary press and releases a bounded pulse", () => {
    const state = createCoverControlState();
    Object.assign(state, { pressed: true, pressedAt: 100 });
    expect(coverCharge(525, state)).toBe(0.5);
    expect(coverCharge(4000, state)).toBe(1);
    state.dragging = true;
    expect(coverCharge(1000, state)).toBe(0);
    state.dragging = false;
    releaseCoverCharge(1000, state);
    expect(state.pressed).toBe(false);
    expect(state.pulsePower).toBe(1);
    expect(state.pulseAt).toBe(1000);
  });
  it("lets a full turn continue without the old 1.1-radian stop", () => {
    const state = createCoverControlState();
    Object.assign(state, { yaw: Math.PI * 2, angularVelocity: 3 });
    advanceCoverInertia(state, 0.05, false);
    expect(state.yaw).toBeGreaterThan(Math.PI * 2);
    expect(state.angularVelocity).toBeLessThan(3);
  });
  it("decays inertia consistently at different frame rates", () => {
    const a = createCoverControlState(), b = createCoverControlState();
    a.angularVelocity = b.angularVelocity = 3;
    for (let n = 0; n < 30; n++) advanceCoverInertia(a, 1 / 30, false);
    for (let n = 0; n < 60; n++) advanceCoverInertia(b, 1 / 60, false);
    expect(a.yaw).toBeCloseTo(b.yaw, 7);
    expect(a.angularVelocity).toBeCloseTo(b.angularVelocity, 7);
  });
  it("stops coasting for reduced motion and while dragging", () => {
    const state = createCoverControlState();
    state.angularVelocity = 2; state.dragging = true;
    advanceCoverInertia(state, 0.03, false); expect(state.yaw).toBe(0);
    state.dragging = false;
    advanceCoverInertia(state, 0.03, true); expect(state.yaw).toBe(0);
    expect(state.angularVelocity).toBe(0);
    expect(clampCoverTilt(2)).toBe(0.18); expect(clampCoverTilt(-2)).toBe(-0.18);
  });
  it("keeps the curved glass symmetric and inside the physical frame", () => {
    expect(coverGlassRadius(0)).toBe(0.075);
    expect(coverGlassRadius(1.66)).toBeCloseTo(0.855);
    for (let y = 0; y < 1.66; y += 0.08) {
      expect(coverGlassRadius(y)).toBeCloseTo(coverGlassRadius(-y));
      expect(coverGlassRadius(y)).toBeLessThan(0.87);
    }
  });
});
