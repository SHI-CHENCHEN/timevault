import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireSessionResource, cameraErrorIssue, cameraSupportIssue } from "./handCameraRuntime";

const supported = { secure: true, media: true, wasm: true, policy: true };
afterEach(() => vi.useRealTimers());
describe("camera compatibility and asynchronous ownership", () => {
  it("supports secure feature-capable browsers without user-agent assumptions", () => expect(cameraSupportIssue(supported)).toBeNull());
  it.each([["secure", "HTTPS_REQUIRED"], ["media", "CAMERA_API"], ["wasm", "WASM_UNAVAILABLE"], ["policy", "CAMERA_POLICY"]] as const)("explains missing %s support", (key, code) => {
    expect(cameraSupportIssue({ ...supported, [key]: false })?.code).toBe(code);
  });
  it("distinguishes denied, busy and missing cameras from model failures", () => {
    expect(cameraErrorIssue({ name: "NotAllowedError" }).code).toBe("CAMERA_DENIED");
    expect(cameraErrorIssue({ name: "NotReadableError" }).code).toBe("CAMERA_BUSY");
    expect(cameraErrorIssue({ name: "NotFoundError" }).code).toBe("NO_CAMERA");
    expect(cameraErrorIssue(new Error("MEDIAPIPE WASM TIMED OUT")).code).toBe("MODEL_START");
    expect(cameraErrorIssue(new Error("VIDEO FRAMES STOPPED")).code).toBe("VIDEO_NOT_READY");
    expect(cameraErrorIssue(new Error("HAND ASSET STALLED: MODEL")).code).toBe("HAND_DOWNLOAD");
  });
  it("does not mistake an unanswered permission prompt for an opened camera", () => {
    expect(cameraErrorIssue(new Error("CAMERA REQUEST TIMED OUT")).code).toBe("CAMERA_PERMISSION_WAIT");
  });
  it("returns a current resource without disposing it", async () => {
    const dispose = vi.fn(); const resource = {};
    expect(await acquireSessionResource(Promise.resolve(resource), 100, "TIMEOUT", () => true, dispose)).toBe(resource);
    expect(dispose).not.toHaveBeenCalled();
  });
  it("disposes a resource returned after stop", async () => {
    const dispose = vi.fn();
    await expect(acquireSessionResource(Promise.resolve({}), 100, "TIMEOUT", () => false, dispose)).rejects.toThrow("SESSION_CANCELLED");
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  it("disposes late resources exactly once after a timeout", async () => {
    vi.useFakeTimers(); let resolve!: (value: object) => void;
    const resource = {}; const dispose = vi.fn();
    const pending = acquireSessionResource(new Promise<object>(r => { resolve = r; }), 100, "MODEL TIMED OUT", () => true, dispose);
    const rejected = expect(pending).rejects.toThrow("MODEL TIMED OUT");
    await vi.advanceTimersByTimeAsync(100); await rejected;
    resolve(resource); await Promise.resolve();
    expect(dispose).toHaveBeenCalledExactlyOnceWith(resource);
  });
});
