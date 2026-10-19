import type { ReserveComposition, ReserveStructure, TimeFragment } from "@timevault/shared";

interface ConsolidationAssignment {
  fragmentId: string;
  state: "LOOSE" | "CLUSTERED" | "CONSOLIDATED";
  clusterId: string;
}

const levels = [
  { units: 12, kind: "MAJOR", state: "CONSOLIDATED" },
  { units: 6, kind: "SHARD", state: "CONSOLIDATED" },
  { units: 3, kind: "CLUSTER", state: "CLUSTERED" },
  { units: 1, kind: "MICRO", state: "LOOSE" },
] as const;

export function buildConsolidationPlan(fragmentIds: string[]): ConsolidationAssignment[] {
  const remaining = [...fragmentIds];
  const assignments: ConsolidationAssignment[] = [];

  for (const level of levels) {
    while (remaining.length >= level.units) {
      const members = remaining.splice(0, level.units);
      const clusterId = `${level.kind}:${members[0]}`;
      for (const fragmentId of members) {
        assignments.push({ fragmentId, state: level.state, clusterId });
      }
    }
  }
  return assignments;
}

export function allocateFragmentsForRecovery(fragments: TimeFragment[], minutes: number): TimeFragment[] {
  if (minutes <= 0 || minutes % 5 !== 0) {
    throw new Error("Recovery minutes must be a positive multiple of five");
  }
  const active = fragments
    .filter((fragment) => fragment.state !== "RECOVERED")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const units = minutes / 5;
  if (active.length < units) throw new Error("INSUFFICIENT TIME RESERVE");
  return active.slice(0, units);
}

export function getReserveComposition(fragments: TimeFragment[]): ReserveComposition {
  const active = fragments.filter((fragment) => fragment.state !== "RECOVERED");
  const groups = new Map<string, TimeFragment[]>();
  for (const fragment of active) {
    const key = fragment.clusterId ?? `MICRO:${fragment.id}`;
    groups.set(key, [...(groups.get(key) ?? []), fragment]);
  }

  const structures: ReserveStructure[] = [...groups.entries()].map(([id, members]) => {
    const prefix = id.split(":", 1)[0];
    const kind = prefix === "MAJOR" || prefix === "SHARD" || prefix === "CLUSTER" ? prefix : "MICRO";
    return {
      id,
      kind,
      minutes: members.reduce((total, fragment) => total + fragment.minutes, 0),
      fragmentIds: members.map((fragment) => fragment.id),
      sourceTransactionIds: [...new Set(members.map((fragment) => fragment.sourceTransactionId))],
    };
  });

  return {
    totalMinutes: active.reduce((total, fragment) => total + fragment.minutes, 0),
    structures,
    counts: {
      micro: structures.filter((item) => item.kind === "MICRO").length,
      cluster: structures.filter((item) => item.kind === "CLUSTER").length,
      shard: structures.filter((item) => item.kind === "SHARD").length,
      major: structures.filter((item) => item.kind === "MAJOR").length,
    },
  };
}
