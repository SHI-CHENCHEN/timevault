import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Points, BufferGeometry, BufferAttribute } from "three";
import { GestureParticleField } from "./gestureParticles";
import { createHandMirrorVisualState, type HandMirrorVisualState } from "./types";

beforeEach(() => vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) }));
afterEach(() => vi.unstubAllGlobals());

// The unavailable text canvas gives a deterministic spring target at the origin.
// Compare one real particle with identical initial conditions to isolate forces.
function particleX(patch: Partial<HandMirrorVisualState>) {
  const field = new GestureParticleField(1, false);
  field.setContext({ visible: true, step: 0, totalSold: 30, reserve: 30, totalRecovered: 0, countdownRemaining: null });
  const points = field.group.children[0] as Points<BufferGeometry>;
  const position = points.geometry.getAttribute("position") as BufferAttribute;
  position.setXYZ(0, 0.2, 0, 0);
  field.update(16, 100, { ...createHandMirrorVisualState(), active: true, ...patch });
  const x = position.getX(0);
  field.dispose();
  return x;
}

describe("distinct physical-hand particle forces", () => {
  it("settles a changed field target within 150 ms instead of leaving a long visual tail", () => {
    const field = new GestureParticleField(1, false);
    field.setContext({ visible: true, step: 0, totalSold: 30, reserve: 30, totalRecovered: 0, countdownRemaining: null });
    const position = (field.group.children[0] as Points<BufferGeometry>).geometry.getAttribute("position") as BufferAttribute;
    position.setXYZ(0, 0.8, 0, 0);
    for (let i = 0; i < 9; i++) field.update(1000 / 60, (i + 1) * 1000 / 60, createHandMirrorVisualState());
    expect(position.getX(0)).toBeLessThan(0.05);
    field.dispose();
  });
  it("follows a target at the same speed at 4, 15 and 60 rendered FPS", () => {
    const positions = [4, 15, 60].map(fps => {
      const field = new GestureParticleField(1, false);
      field.setContext({ visible: true, step: 0, totalSold: 30, reserve: 30, totalRecovered: 0, countdownRemaining: null });
      const points = field.group.children[0] as Points<BufferGeometry>;
      const position = points.geometry.getAttribute("position") as BufferAttribute;
      position.setXYZ(0, 0.8, 0, 0);
      for (let i = 0; i < fps; i++) field.update(1000 / fps, (i + 1) * 1000 / fps, createHandMirrorVisualState());
      const x = position.getX(0); field.dispose(); return x;
    });
    expect(positions[0]).toBeCloseTo(positions[2], 5);
    expect(positions[1]).toBeCloseTo(positions[2], 5);
    expect(positions[0]).toBeLessThan(0.001);
  });
  it("a neutral right palm leaves a nearby particle on its normal spring path", () => {
    const ambient = particleX({});
    const right = particleX({ rightDetected: true, rightPalmX: 0.5, rightPalmY: 0.5 });
    expect(right).toBeCloseTo(ambient, 7);
  });
  it("the left palm pushes while a right pinch pulls from the same location", () => {
    const ambient = particleX({});
    const left = particleX({ leftDetected: true, leftPalmX: 0.5, leftPalmY: 0.5, leftRepelStrength: 1 });
    const right = particleX({ rightDetected: true, rightPalmX: 0.5, rightPalmY: 0.5, rightPinch: 1 });
    expect(left).toBeGreaterThan(ambient);
    expect(right).toBeLessThan(ambient);
  });
  it("a right pinch cannot cancel the left-palm push where the hands overlap", () => {
    const left = { leftDetected: true, leftPalmX: 0.5, leftPalmY: 0.5, leftRepelStrength: 1 };
    expect(particleX({ ...left, rightDetected: true, rightPalmX: 0.5, rightPalmY: 0.5, rightPinch: 1 }))
      .toBeCloseTo(particleX(left), 7);
  });
});
