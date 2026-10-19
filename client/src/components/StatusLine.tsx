import type { HardwareState, StorageState } from "@timevault/shared";

export function StatusLine({ hardware, storage, serverConnected }: { hardware: HardwareState; storage: StorageState; serverConnected: boolean }) {
  const label = !serverConnected
    ? "OFFLINE"
    : hardware.status === "CONNECTED"
      ? "ACTIVE"
      : hardware.status === "SIMULATION"
        ? "SIMULATED"
        : "STANDBY";
  return (
    <div className="status-group">
      {storage.status === "MEMORY" ? <span className="storage-warning" title={storage.error ?? undefined}>VOLATILE MEMORY</span> : null}
      <div className="status-line" title={hardware.activePort ?? hardware.error ?? undefined}>
        <span>PHYSICAL LINK</span>
        <i className={`status-dot status-dot--${serverConnected ? hardware.status.toLowerCase() : "disconnected"}`} />
        <strong>{label}</strong>
      </div>
    </div>
  );
}
