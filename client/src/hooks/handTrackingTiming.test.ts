import { describe, expect, it } from "vitest";
import { HandFramePacer, isFreshHandSample, palmSmoothingMs, smoothHandValue } from "./handTrackingTiming";

describe("fresh-frame hand scheduling", () => {
  it.each([24, 25, 30, 60])("uses %i FPS input without the old half-rate trap", fps => {
    const pacer = new HandFramePacer();
    let accepted = 0;
    for (let frame = 0; frame < fps; frame++) {
      if (pacer.begin(frame * 1000 / fps, frame / fps)) { accepted++; pacer.complete(8, true); }
    }
    expect(accepted).toBe(Math.min(30, fps));
  });

  it("never queues concurrent or duplicate frames and resumes from the latest frame", () => {
    const pacer = new HandFramePacer();
    expect(pacer.begin(0, 0)).toBe(true);
    expect(pacer.begin(40, 0.04)).toBe(false);
    expect(pacer.begin(80, 0.08)).toBe(false);
    pacer.complete(80, true);
    expect(pacer.begin(100, 0.1)).toBe(true);
    pacer.complete(10, true);
    expect(pacer.begin(150, 0.1)).toBe(false);
    expect(pacer.begin(150, 0.15)).toBe(true);
  });

  it("backs off slow main-thread inference without throttling a worker", () => {
    const main = new HandFramePacer();
    const worker = new HandFramePacer();
    for (const pacer of [main, worker]) { pacer.begin(0, 0); pacer.complete(90, pacer === worker); pacer.begin(100, 0.1); pacer.complete(90, pacer === worker); }
    expect(main.begin(140, 0.14)).toBe(false);
    expect(worker.begin(140, 0.14)).toBe(true);
  });

  it("rejects stale, future and hidden-tab backlog timestamps", () => {
    expect(isFreshHandSample(100, 140)).toBe(true);
    expect(isFreshHandSample(100, 401)).toBe(false);
    expect(isFreshHandSample(101, 100)).toBe(false);
  });
});

describe("time-based hand response", () => {
  it.each([12, 24, 30, 60])("settles openness within 100 ms at %i samples/sec", fps => {
    let value = 0;
    const count = Math.ceil(100 / (1000 / fps));
    for (let index = 0; index < count; index++) value = smoothHandValue(value, 1, 1000 / fps);
    expect(value).toBeGreaterThan(0.9);
    expect(value).toBeLessThanOrEqual(1);
  });

  it("retains stationary jitter filtering and catches deliberate moves faster", () => {
    expect(palmSmoothingMs(0.002)).toBeGreaterThan(palmSmoothingMs(0.1));
    expect(smoothHandValue(0.5, 0.504, 33, palmSmoothingMs(0.004))).toBeLessThan(0.504);
    expect(smoothHandValue(0.2, 0.8, 33, palmSmoothingMs(0.6))).toBeGreaterThan(0.65);
  });

  it("does not overshoot or jump after a long pause", () => {
    const value = smoothHandValue(0.2, 0.8, 10_000);
    expect(value).toBeGreaterThan(0.2);
    expect(value).toBeLessThan(0.8);
  });
});
