import { describe, expect, it } from "vitest";
import type { TimeFragment } from "@timevault/shared";
import { allocateFragmentsForRecovery, buildConsolidationPlan, getReserveComposition } from "./fragments";

const fragment = (id: string): TimeFragment => ({
  id,
  sourceTransactionId: `tx-${id}`,
  minutes: 5,
  createdAt: `2026-01-01T00:00:0${id}.000Z`,
  state: "LOOSE",
  clusterId: null,
  recoveredByTransactionId: null,
});

describe("fragment logic", () => {
  it("consolidates 15 minutes while preserving all source fragment ids", () => {
    const plan = buildConsolidationPlan(["1", "2", "3"]);
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((item) => item.clusterId)).size).toBe(1);
    expect(plan.every((item) => item.state === "CLUSTERED")).toBe(true);
  });

  it("uses major, shard, cluster, then loose thresholds", () => {
    const plan = buildConsolidationPlan(Array.from({ length: 22 }, (_, index) => String(index)));
    expect(plan.filter((item) => item.clusterId.startsWith("MAJOR")).length).toBe(12);
    expect(plan.filter((item) => item.clusterId.startsWith("SHARD")).length).toBe(6);
    expect(plan.filter((item) => item.clusterId.startsWith("CLUSTER")).length).toBe(3);
    expect(plan.filter((item) => item.clusterId.startsWith("MICRO")).length).toBe(1);
  });

  it("allocates exact five-minute units for recovery", () => {
    const fragments = [fragment("1"), fragment("2"), fragment("3"), fragment("4")];
    expect(allocateFragmentsForRecovery(fragments, 15).map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(() => allocateFragmentsForRecovery(fragments, 25)).toThrow("INSUFFICIENT TIME RESERVE");
  });

  it("reports composition without recovered fragments", () => {
    const active = fragment("1");
    active.clusterId = "MICRO:1";
    const recovered = fragment("2");
    recovered.state = "RECOVERED";
    const composition = getReserveComposition([active, recovered]);
    expect(composition.totalMinutes).toBe(5);
    expect(composition.counts.micro).toBe(1);
  });
});
