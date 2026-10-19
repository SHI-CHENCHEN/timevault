import type { TransactionType } from "@timevault/shared";

// Read-only receipt projection; the existing coordinator still commits exchanges.
export function transactionPreview(reserve: number, minutes: number, mode: TransactionType) {
  return {
    before: reserve,
    after: mode === "SELL" ? reserve + minutes : reserve - minutes,
    units: minutes / 5,
    direction: mode === "SELL" ? "INTO THE RESERVE" : "BACK TO YOU",
    available: mode === "SELL" || reserve >= minutes,
  };
}
