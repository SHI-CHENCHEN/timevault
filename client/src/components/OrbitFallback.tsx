import type { InstallationSnapshot } from "@timevault/shared";

const REFLECTION_LABELS = ["LOST TIME", "TIME RESERVE", "TIME RETURNED"] as const;

export function OrbitFallback({
  snapshot,
  handMirrorActive = false,
}: {
  snapshot: InstallationSnapshot;
  handMirrorActive?: boolean;
}) {
  const active = ["TIME_SELECTION", "CONFIRMATION", "TRANSACTION_PROCESSING", "BUYBACK_COUNTDOWN"].includes(
    snapshot.interaction.currentScreen,
  );
  const units = active ? snapshot.interaction.selectedMinutes / 5 : 0;
  return (
    <div className="orbit-fallback" aria-label={`Time reserve ${snapshot.account.timeReserve} minutes`}>
      {handMirrorActive && snapshot.interaction.currentScreen === "REFLECTION" ? (
        <div className="fallback-hand-mirror">
          <span>{REFLECTION_LABELS[snapshot.interaction.reflectionStep]}</span>
          <div className="fallback-hand-mirror__core"><i /><i /><i /><b /></div>
        </div>
      ) : null}
      <div className="fallback-arc fallback-arc--outer" />
      <div className="fallback-arc fallback-arc--middle" />
      <div className="fallback-arc fallback-arc--inner" />
      {snapshot.composition.structures.slice(0, 24).map((structure, index, structures) => {
        const angle = -90 + (index / Math.max(1, structures.length)) * 312;
        return (
          <span
            key={structure.id}
            className={`fallback-structure fallback-structure--${structure.kind.toLowerCase()}`}
            style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-18vmin)` }}
          />
        );
      })}
      {Array.from({ length: units }, (_, index) => (
        <span
          className="fallback-active-fragment"
          key={index}
          style={{ transform: `translate(-50%, -50%) rotate(${(index / Math.max(1, units)) * 300 - 150}deg) translateY(-9vmin)` }}
        />
      ))}
    </div>
  );
}
