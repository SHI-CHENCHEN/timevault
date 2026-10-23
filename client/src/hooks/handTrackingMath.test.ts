import { describe, expect, it } from "vitest";
import {
  advanceGestureMachine,
  countExtendedFingers,
  createGestureMachineState,
  deriveHandMetrics,
  mapMediaPipeHandedness,
  projectCameraPoint,
  type LandmarkLike,
} from "./handTrackingMath";

function handWithFingers(count: number): LandmarkLike[] {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }));
  points[0] = { x: 0.5, y: 0.86, z: 0 };
  points[5] = { x: 0.4, y: 0.64, z: 0 };
  points[9] = { x: 0.48, y: 0.6, z: 0 };
  points[13] = { x: 0.56, y: 0.64, z: 0 };
  points[17] = { x: 0.64, y: 0.69, z: 0 };
  const triples = [[8, 6, 5], [12, 10, 9], [16, 14, 13], [20, 18, 17]];
  triples.forEach(([tip, pip, mcp], index) => {
    const x = 0.4 + index * 0.08;
    points[mcp] = { x, y: 0.64, z: 0 };
    points[pip] = { x, y: 0.54, z: 0 };
    points[tip] = { x, y: index < count ? 0.29 : 0.58, z: 0 };
  });
  return points;
}

describe("hand tracking math", () => {
  it("counts the one, two, and three finger reflection gestures", () => {
    expect(countExtendedFingers(handWithFingers(1))).toBe(1);
    expect(countExtendedFingers(handWithFingers(2))).toBe(2);
    expect(countExtendedFingers(handWithFingers(3))).toBe(3);
  });

  it("derives bounded openness and mirrored display coordinates", () => {
    const metrics = deriveHandMetrics(handWithFingers(4));
    expect(metrics.openness).toBeGreaterThan(0.45);
    expect(metrics.openness).toBeLessThanOrEqual(1);
    expect(metrics.palmX).toBeGreaterThan(0.3);
    expect(metrics.palmX).toBeLessThan(0.7);
    expect(metrics.pinch).toBeGreaterThanOrEqual(0);
    expect(metrics.pinch).toBeLessThanOrEqual(1);
  });

  it("detects a thumb and index pinch independently of palm position", () => {
    const open = handWithFingers(4);
    open[4] = { x: 0.28, y: 0.45, z: 0 };
    open[8] = { x: 0.42, y: 0.29, z: 0 };
    const pinched = handWithFingers(4);
    pinched[4] = { x: 0.4, y: 0.31, z: 0 };
    pinched[8] = { x: 0.41, y: 0.3, z: 0 };
    expect(deriveHandMetrics(pinched).pinch).toBeGreaterThan(deriveHandMetrics(open).pinch);
  });

  it("preserves physical hand identity when only the CSS preview is mirrored", () => {
    expect(mapMediaPipeHandedness("Left")).toBe("LEFT");
    expect(mapMediaPipeHandedness("Right")).toBe("RIGHT");
    expect(mapMediaPipeHandedness(" left ")).toBe("LEFT");
    expect(mapMediaPipeHandedness("unknown")).toBeNull();
  });

  it("swaps physical hand identity only for mirrored inference pixels", () => {
    expect(mapMediaPipeHandedness("Left", true)).toBe("RIGHT");
    expect(mapMediaPipeHandedness("Right", true)).toBe("LEFT");
    expect(mapMediaPipeHandedness("Left", false)).toBe("LEFT");
  });

  it("aligns the mirrored palm with an object-fit cover camera on wide screens", () => {
    const viewport = { videoWidth: 640, videoHeight: 480, displayWidth: 1920, displayHeight: 1080 };
    expect(projectCameraPoint({ x: 0.5, y: 0.5 }, viewport)).toEqual({ x: 0.5, y: 0.5 });
    const point = projectCameraPoint({ x: 0.25, y: 0.25 }, viewport);
    expect(point.x).toBeCloseTo(0.75625);
    expect(point.y).toBeCloseTo(0.1583333);
  });

  it("keeps offscreen camera coordinates offscreen rather than pinning them to the edge", () => {
    const viewport = { videoWidth: 640, videoHeight: 480, displayWidth: 390, displayHeight: 844 };
    const point = projectCameraPoint({ x: 0.05, y: 0.5 }, viewport);
    expect(point.x).toBeGreaterThan(1);
    expect(point.y).toBe(0.5);
    expect(projectCameraPoint({ x: 0.2, y: 0.3 })).toEqual({ x: 0.8, y: 0.3 });
  });

  it("does not let viewport cropping change gesture geometry", () => {
    const hand = handWithFingers(3);
    const plain = deriveHandMetrics(hand);
    const cropped = deriveHandMetrics(hand, { videoWidth: 640, videoHeight: 480, displayWidth: 390, displayHeight: 844 });
    expect(cropped.fingerCount).toBe(plain.fingerCount);
    expect(cropped.openness).toBe(plain.openness);
    expect(cropped.pinch).toBe(plain.pinch);
    expect(cropped.rotation).toBe(plain.rotation);
  });

  it("blocks warmup, then requires a deliberate 700 ms stable pose", () => {
    let state = createGestureMachineState(0);
    let result = advanceGestureMachine(state, { detected: true, fingerCount: 2 }, 400, 0);
    expect(result.commit).toBeNull();
    state = result.state;
    result = advanceGestureMachine(state, { detected: true, fingerCount: 2 }, 700, 0);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 2 }, 1350, 0);
    expect(result.commit).toBeNull();
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 2 }, 1400, 0);
    expect(result.commit).toBe(1);
    expect(result.state.phase).toBe("confirmed");
  });

  it("requires neutral release and cooldown before another commit", () => {
    let state = createGestureMachineState(-2000);
    let result = advanceGestureMachine(state, { detected: true, fingerCount: 2 }, 0, 0);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 2 }, 1200, 0);
    expect(result.commit).toBe(1);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 3 }, 1300, 1);
    expect(result.commit).toBeNull();
    expect(result.state.phase).toBe("waiting-for-release");
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 0 }, 1400, 1);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 0 }, 1800, 1);
    expect(result.state.phase).toBe("cooldown");
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 3 }, 2500, 1);
    expect(result.commit).toBeNull();
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 3 }, 3100, 1);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 3 }, 4250, 1);
    expect(result.commit).toBe(2);
  });

  it("tolerates a short dropout but resets after prolonged tracking loss", () => {
    let state = createGestureMachineState(-2000);
    let result = advanceGestureMachine(state, { detected: true, fingerCount: 1 }, 0, 2);
    result = advanceGestureMachine(result.state, { detected: false, fingerCount: 0 }, 300, 2);
    expect(result.state.candidate).toBe(1);
    result = advanceGestureMachine(result.state, { detected: false, fingerCount: 0 }, 700, 2);
    expect(result.state.phase).toBe("lost");
    expect(result.state.candidate).toBeNull();
  });

  it("does not count tracking loss as a neutral release", () => {
    let state = createGestureMachineState(-2000);
    let result = advanceGestureMachine(state, { detected: true, fingerCount: 1 }, 0, 2);
    result = advanceGestureMachine(result.state, { detected: true, fingerCount: 1 }, 1200, 2);
    result = advanceGestureMachine(result.state, { detected: false, fingerCount: 0 }, 1400, 0);
    expect(result.state.phase).toBe("waiting-for-release");
  });
});
