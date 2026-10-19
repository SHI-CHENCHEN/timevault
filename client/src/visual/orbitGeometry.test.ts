import { describe, expect, it } from "vitest";
import type { ReserveStructure } from "@timevault/shared";
import { getVisualStructureSpecs, stableUnit } from "./orbitGeometry";

const structure = (id: string, kind: ReserveStructure["kind"], minutes: number): ReserveStructure => ({
  id,
  kind,
  minutes,
  fragmentIds: [id],
  sourceTransactionIds: [`tx-${id}`],
});

describe("Digital Orbit mapping", () => {
  it("maps reserve structures deterministically", () => {
    const input = [structure("a", "MICRO", 5), structure("b", "CLUSTER", 15), structure("c", "SHARD", 30)];
    expect(getVisualStructureSpecs(input)).toEqual(getVisualStructureSpecs(input));
    expect(getVisualStructureSpecs(input).map((item) => item.kind)).toEqual(["MICRO", "CLUSTER", "SHARD"]);
  });

  it("keeps stable hashes within a unit interval", () => {
    expect(stableUnit("TIMEVAULT")).toBe(stableUnit("TIMEVAULT"));
    expect(stableUnit("TIMEVAULT")).toBeGreaterThanOrEqual(0);
    expect(stableUnit("TIMEVAULT")).toBeLessThanOrEqual(1);
  });
});
