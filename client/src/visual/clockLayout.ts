export const CLOCK_SLOTS = 12;

export function clockHandRotation(epochMs: number, timezoneOffsetMinutes: number, periodSeconds: number): number {
  const seconds = epochMs / 1000 - timezoneOffsetMinutes * 60;
  const turn = ((seconds % periodSeconds) + periodSeconds) % periodSeconds;
  return -(turn / periodSeconds) * Math.PI * 2;
}

export function clockSlot(index: number, slots = CLOCK_SLOTS): { x: number; y: number; angle: number } {
  const angle = ((index + 1) / Math.max(1, slots)) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle), y: Math.sin(angle), angle };
}

export function clockFragmentCount(minutes: number): number {
  return Math.min(CLOCK_SLOTS, Math.max(0, Math.floor(minutes / 5)));
}

export function clockFieldSizing(width: number, height: number): { radius: number; unitPixels: number } {
  const radius = Math.max(0, Math.min(width, height) * 0.36);
  return { radius, unitPixels: Math.min(62, radius * 0.3) };
}
