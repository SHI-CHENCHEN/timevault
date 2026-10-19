import { describe, expect, it } from "vitest";
import { clockFieldSizing, clockFragmentCount, clockHandRotation, clockSlot } from "./clockLayout";

describe("five-minute clock presentation", () => {
  it("maps each duration to exact five-minute units", () => {
    expect([5, 15, 30, 45, 60].map(clockFragmentCount)).toEqual([1, 3, 6, 9, 12]);
  });
  it("fills a sixty-minute clock clockwise with twelve distinct slots", () => {
    const positions = Array.from({ length: 12 }, (_, index) => clockSlot(index));
    expect(positions[0].x).toBeGreaterThan(0);
    expect(positions[11].x).toBeCloseTo(0);
    expect(positions[11].y).toBeCloseTo(-1);
    expect(new Set(positions.map(({ x, y }) => `${x.toFixed(5)},${y.toFixed(5)}`)).size).toBe(12);
  });
  it("keeps the whole clock and fragments inside the measured field", () => {
    for (const [width, height] of [[700, 500], [340, 200], [260, 260]]) {
      const { radius, unitPixels } = clockFieldSizing(width, height);
      expect(radius + unitPixels).toBeLessThan(Math.min(width, height) / 2);
    }
  });
});

describe("cover chronometer", () => {
  it("moves the second hand clockwise continuously", () => {
    expect(clockHandRotation(30_000, 0, 60)).toBeCloseTo(-Math.PI);
    expect(clockHandRotation(15_500, 0, 60)).toBeCloseTo(-31 / 60 * Math.PI);
  });
  it("uses the visitor's local timezone for the twelve-hour hand", () => {
    expect(clockHandRotation(0, -480, 43_200)).toBeCloseTo(-4 * Math.PI / 3);
    expect(clockHandRotation(0, 0, 43_200)).toBeCloseTo(0);
  });
  it("wraps cleanly at each hand's cycle", () => {
    expect(clockHandRotation(60_000, 0, 60)).toBeCloseTo(0);
    expect(clockHandRotation(-15_000, 0, 60)).toBeCloseTo(-1.5 * Math.PI);
  });
});
