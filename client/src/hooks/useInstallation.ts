import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  CanonicalAction,
  ClientToServerEvents,
  InstallationSnapshot,
  ServerToClientEvents,
} from "@timevault/shared";
import { useStandaloneInstallation } from "./useStandaloneInstallation";

type TimeVaultSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function useNetworkInstallation() {
  const socket = useMemo<TimeVaultSocket>(() => io({ autoConnect: true }), []);
  const [snapshot, setSnapshot] = useState<InstallationSnapshot | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setConnected(true);
      socket.emit("request_state");
    };
    const handleDisconnect = () => setConnected(false);
    const handleNotice = (message: string) => {
      setNotice(message);
      window.setTimeout(() => setNotice(null), 3000);
    };
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("state", setSnapshot);
    socket.on("notice", handleNotice);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("state", setSnapshot);
      socket.off("notice", handleNotice);
      socket.disconnect();
    };
  }, [socket]);

  const action = (value: CanonicalAction) => socket.emit("action", value);
  const simulate = (value: CanonicalAction) => socket.emit("simulator_action", value);

  return { socket, snapshot, connected, notice, action, simulate };
}

export function useInstallation() {
  if (import.meta.env.VITE_STANDALONE === "true") return useStandaloneInstallation();
  return useNetworkInstallation();
}
