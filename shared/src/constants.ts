export const TIME_OPTIONS = [5, 15, 30, 45, 60] as const;

export const DEFAULT_CONFIG = {
  demoTimeMultiplier: 60,
  showCurrency: false,
  timeValuePerMinute: 1,
} as const;

export const SERIAL_BAUD_RATE = 115_200;

export type TimeOption = (typeof TIME_OPTIONS)[number];
