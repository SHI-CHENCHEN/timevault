type Side = "LEFT" | "RIGHT";
interface Candidate { side: Side; x: number; y: number; score: number }
interface Track { x: number; y: number; vx: number; vy: number; at: number }

/** Physical labels seed identity; short motion continuity prevents role swaps.
 * Screen halves never determine handedness. Lost hands expire and are relabeled.
 */
export class HandIdentityTracker {
  private tracks = new Map<Side, Track>();
  clear() { this.tracks.clear(); }

  resolve<T extends Candidate>(candidates: T[], now: number): T[] {
    for (const [side, track] of this.tracks) if (now - track.at > 700) this.tracks.delete(side);
    const assigned = new Map<Side, number>();
    const used = new Set<number>();
    const distance = (side: Side, index: number) => {
      const track = this.tracks.get(side);
      if (!track) return Infinity;
      const ahead = Math.min(0.12, Math.max(0, now - track.at) / 1000);
      return Math.hypot(candidates[index].x - track.x - track.vx * ahead, candidates[index].y - track.y - track.vy * ahead);
    };
    const put = (side: Side, index: number) => { assigned.set(side, index); used.add(index); };
    if (candidates.length === 2 && this.tracks.size === 2) {
      const cost = (left: number, right: number) => {
        const a = distance("LEFT", left), b = distance("RIGHT", right);
        return a > 0.26 || b > 0.26 ? Infinity : a + b
          + (candidates[left].side === "LEFT" ? 0 : 0.015) + (candidates[right].side === "RIGHT" ? 0 : 0.015);
      };
      const straight = cost(0, 1), crossed = cost(1, 0);
      if (Math.min(straight, crossed) < Infinity) {
        put("LEFT", straight <= crossed ? 0 : 1); put("RIGHT", straight <= crossed ? 1 : 0);
      }
    }
    // Retain a nearby established identity even if one frame's label flips.
    for (let pass = 0; pass < 2; pass++) {
      let best: { side: Side; index: number; cost: number } | null = null;
      for (const side of ["LEFT", "RIGHT"] as const) {
        if (assigned.has(side)) continue;
        candidates.forEach((candidate, index) => {
          if (used.has(index)) return;
          const d = distance(side, index);
          const cost = d + (candidate.side === side ? 0 : 0.015);
          if (d <= 0.26 && (!best || cost < best.cost)) best = { side, index, cost };
        });
      }
      if (best) { const match = best as { side: Side; index: number }; put(match.side, match.index); }
    }
    // New hands use the model's physical label, never a guessed screen side.
    [...candidates.keys()].sort((a, b) => candidates[b].score - candidates[a].score).forEach(index => {
      const side = candidates[index].side;
      if (!used.has(index) && !assigned.has(side)) put(side, index);
    });
    const output: T[] = [];
    for (const [side, index] of assigned) {
      const candidate = candidates[index], previous = this.tracks.get(side);
      const elapsed = previous ? Math.max(0.025, (now - previous.at) / 1000) : 1;
      const limit = (value: number) => Math.max(-2, Math.min(2, value));
      this.tracks.set(side, { x: candidate.x, y: candidate.y, at: now,
        vx: previous ? limit((candidate.x - previous.x) / elapsed) * 0.65 + previous.vx * 0.35 : 0,
        vy: previous ? limit((candidate.y - previous.y) / elapsed) * 0.65 + previous.vy * 0.35 : 0 });
      output.push({ ...candidate, side });
    }
    return output;
  }
}
