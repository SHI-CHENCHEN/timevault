import { describe, expect, it } from "vitest";
import { transactionPreview } from "./transactionPreview";

describe("read-only exchange receipt", () => {
  it("projects SELL without changing the existing reserve", () => {
    expect(transactionPreview(75, 30, "SELL")).toMatchObject({ before: 75, after: 105, units: 6, available: true });
  });
  it("projects BUY against the same reserve", () => {
    expect(transactionPreview(75, 15, "BUY")).toMatchObject({ before: 75, after: 60, units: 3, available: true });
  });
  it("keeps exact five-minute lineage counts for every duration", () => {
    expect([5, 15, 30, 45, 60].map(minutes => transactionPreview(60, minutes, "SELL").units)).toEqual([1, 3, 6, 9, 12]);
  });
  it("identifies an insufficient reserve without committing or clamping it", () => {
    expect(transactionPreview(5, 15, "BUY")).toMatchObject({ before: 5, after: -10, available: false });
  });
});
