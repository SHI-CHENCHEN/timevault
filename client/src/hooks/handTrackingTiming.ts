// Timing is expressed in milliseconds, never in a fixed number of detections.
// A 24 FPS camera must not lose every other frame to a 52 ms throttle.
export const HAND_SAMPLE_INTERVAL_MS = 1000 / 30;
export const MAX_HAND_SAMPLE_AGE_MS = 300;

export class HandFramePacer {
  private busy = false;
  private nextAt = -Infinity;
  private videoTime = -1;
  private interval = HAND_SAMPLE_INTERVAL_MS;

  begin(now: number, videoTime: number): boolean {
    if (this.busy || videoTime === this.videoTime || now + 2 < this.nextAt) return false;
    this.busy = true;
    this.videoTime = videoTime;
    this.nextAt = Math.max(now, this.nextAt) + this.interval;
    return true;
  }

  complete(inferenceMs: number, background: boolean): void {
    this.busy = false;
    // The compatibility path yields time back to rendering on slower devices.
    this.interval = background ? HAND_SAMPLE_INTERVAL_MS : Math.max(HAND_SAMPLE_INTERVAL_MS, Math.min(160, inferenceMs * 1.5));
  }
}

export function smoothingAmount(elapsedMs: number, timeConstantMs: number): number {
  return 1 - Math.exp(-Math.max(1, Math.min(200, elapsedMs)) / timeConstantMs);
}

export function smoothHandValue(current: number, target: number, elapsedMs: number, timeConstantMs = 40): number {
  return current + (target - current) * smoothingAmount(elapsedMs, timeConstantMs);
}

export function palmSmoothingMs(distance: number): number {
  // Suppress small stationary jitter, but stop dragging behind a deliberate move.
  return 50 - Math.min(1, distance / 0.045) * 28;
}

export function isFreshHandSample(capturedAt: number, now: number): boolean {
  return now >= capturedAt && now - capturedAt <= MAX_HAND_SAMPLE_AGE_MS;
}
