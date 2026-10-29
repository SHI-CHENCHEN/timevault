import { describe, expect, it, vi } from "vitest";
import { cameraFrameToken, startHandVideoLoop } from "./handVideoLoop";
import { HandFramePacer } from "./handTrackingTiming";

describe("camera delivery independent of the video callback API", () => {
  it("continues processing a moving camera without any video-frame callbacks and cancels on teardown", () => {
    const callbacks = new Map<number, FrameRequestCallback>(); let next = 0;
    const request = (callback: FrameRequestCallback) => { callbacks.set(++next, callback); return next; };
    const cancel = vi.fn((id: number) => callbacks.delete(id));
    const pacer = new HandFramePacer(); const processed: number[] = [];
    const video = { currentTime: 0 };
    const stop = startHandVideoLoop(now => {
      if (pacer.begin(now, cameraFrameToken(video, now))) { processed.push(now); pacer.complete(5, true); }
    }, request, cancel);
    for (let i = 0; i < 30; i++) {
      video.currentTime = i / 24;
      const [id, callback] = callbacks.entries().next().value!;
      callbacks.delete(id); callback(i * 1000 / 24);
    }
    expect(processed).toHaveLength(30);
    const lateCallback = callbacks.values().next().value!;
    stop(); lateCallback(2000);
    expect(callbacks.size).toBe(0);
    expect(processed).toHaveLength(30);
  });

  it("accepts new compositor frames when the embedded browser's video clock is frozen", () => {
    let frames = 1;
    const video = { currentTime: 0, getVideoPlaybackQuality: () => ({ totalVideoFrames: frames }) };
    const pacer = new HandFramePacer();
    expect(pacer.begin(0, cameraFrameToken(video, 0))).toBe(true); pacer.complete(5, true);
    expect(pacer.begin(40, cameraFrameToken(video, 40))).toBe(false);
    frames++;
    expect(pacer.begin(40, cameraFrameToken(video, 40))).toBe(true);
  });
});
