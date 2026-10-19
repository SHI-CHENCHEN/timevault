/** Transient cover exploration only. Never contains account or transaction state. */
export interface CoverControlState {
  yaw: number;
  pitch: number;
  angularVelocity: number;
  hovering: boolean;
  pressed: boolean;
  pressedAt: number;
  pulseAt: number;
  pulsePower: number;
  dragging: boolean;
  flowPaused: boolean;
  flowDirection: 1 | -1;
}

export const clampCoverTilt = (pitch: number) => Math.max(-0.18, Math.min(0.18, pitch));

export function createCoverControlState(): CoverControlState {
  return { yaw: 0, pitch: 0, angularVelocity: 0, hovering: false, pressed: false, pressedAt: 0,
    pulseAt: 0, pulsePower: 0.5, dragging: false, flowPaused: false, flowDirection: 1 };
}

export function coverCharge(now: number, controls: CoverControlState): number {
  return controls.pressed && !controls.dragging ? Math.max(0, Math.min(1, (now - controls.pressedAt) / 850)) : 0;
}

export function releaseCoverCharge(now: number, controls: CoverControlState): void {
  controls.pulsePower = 0.45 + coverCharge(now, controls) * 0.55;
  controls.pulseAt = now;
  controls.pressed = false;
}

export function advanceCoverInertia(controls: CoverControlState, deltaSeconds: number, reducedMotion: boolean): void {
  if (controls.dragging || controls.pressed) return;
  if (reducedMotion) { controls.angularVelocity = 0; return; }
  const delta = Math.max(0, Math.min(0.05, deltaSeconds));
  const decay = Math.exp(-5.5 * delta);
  controls.yaw += controls.angularVelocity * (1 - decay) / 5.5;
  controls.angularVelocity *= decay;
  if (Math.abs(controls.angularVelocity) < 0.008) controls.angularVelocity = 0;
}

/** Curved glass shoulders, fitted inside the unchanged silver frame. */
export function coverGlassRadius(y: number): number {
  const t = Math.min(1, Math.abs(y) / 1.66);
  return 0.075 + 0.78 * Math.pow(Math.sin(t * Math.PI / 2), 1.12);
}
