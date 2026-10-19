import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@timevault/shared";
import type { InstallationCoordinator } from "./coordinator";

export function attachSocketServer(httpServer: HttpServer, coordinator: InstallationCoordinator, clientOrigin: string) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: clientOrigin },
  });

  coordinator.setEmitter((snapshot) => io.emit("state", snapshot));

  io.on("connection", (socket) => {
    socket.emit("state", coordinator.getSnapshot());
    socket.on("request_state", () => socket.emit("state", coordinator.getSnapshot()));
    socket.on("action", (action) => coordinator.dispatch(action, "MOUSE"));
    socket.on("simulator_action", (action) => coordinator.dispatch(action, "ARDUINO"));
    socket.on("simulator_connection", (connected) => void coordinator.serial.setSimulation(connected));
    socket.on("simulator_feedback", (kind) => coordinator.serial.recordSimulatedFeedback(kind));
    socket.on("add_test_reserve", (minutes) => coordinator.addTestReserve(minutes));
    socket.on("reset_database", () => coordinator.resetDatabase());
    socket.on("refresh_ports", () => void coordinator.serial.refreshPorts());
    socket.on("connect_port", (path) => void coordinator.serial.connect(path));
    socket.on("disconnect_port", () => void coordinator.serial.disconnect());
  });

  return io;
}
