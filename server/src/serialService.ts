import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";
import { SERIAL_BAUD_RATE, arduinoMessageToAction, parseArduinoLine } from "@timevault/shared";
import type { ArduinoFeedback, CanonicalAction, HardwareState, SerialPortInfo } from "@timevault/shared";

interface SerialServiceOptions {
  configuredPort: string | null;
  autoConnect: boolean;
  onAction: (action: CanonicalAction) => void;
  onStateChange: () => void;
}

export class SerialService {
  private port: SerialPort | null = null;
  private simulation = false;
  private connecting = false;
  private state: HardwareState = {
    status: "DISCONNECTED",
    activePort: null,
    availablePorts: [],
    lastMessage: null,
    lastFeedback: null,
    error: null,
  };

  constructor(private readonly options: SerialServiceOptions) {}

  getState(): HardwareState {
    return { ...this.state, availablePorts: [...this.state.availablePorts] };
  }

  async initialize(): Promise<void> {
    await this.refreshPorts();
    if (this.options.configuredPort) {
      await this.connect(this.options.configuredPort);
    } else if (this.options.autoConnect) {
      const likely = this.state.availablePorts.find((port) =>
        /arduino|usbmodem|usbserial|ttyacm/i.test(`${port.manufacturer ?? ""} ${port.path}`),
      );
      if (likely) await this.connect(likely.path);
    }
  }

  async refreshPorts(): Promise<void> {
    try {
      const ports = await SerialPort.list();
      this.state.availablePorts = ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        vendorId: port.vendorId,
        productId: port.productId,
      })) satisfies SerialPortInfo[];
      this.state.error = null;
    } catch (error) {
      this.state.error = `Serial discovery unavailable: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.options.onStateChange();
  }

  async connect(path: string): Promise<void> {
    if (this.connecting || (this.port?.isOpen && this.state.activePort === path)) return;
    this.connecting = true;
    this.simulation = false;
    await this.disconnect();
    try {
      const port = new SerialPort({ path, baudRate: SERIAL_BAUD_RATE, autoOpen: false });
      await new Promise<void>((resolve, reject) => port.open((error) => (error ? reject(error) : resolve())));
      this.port = port;
      this.state = { ...this.state, status: "CONNECTED", activePort: path, error: null };
      const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
      parser.on("data", (raw: string) => this.handleLine(raw.trim()));
      port.on("error", (error) => {
        this.state.error = error.message;
        this.options.onStateChange();
      });
      port.on("close", () => {
        this.port = null;
        if (!this.simulation) this.state = { ...this.state, status: "DISCONNECTED", activePort: null };
        this.options.onStateChange();
      });
    } catch (error) {
      this.port = null;
      this.state = {
        ...this.state,
        status: "DISCONNECTED",
        activePort: null,
        error: `Unable to open ${path}: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      this.connecting = false;
      this.options.onStateChange();
    }
  }

  async disconnect(): Promise<void> {
    const current = this.port;
    this.port = null;
    if (current?.isOpen) {
      await new Promise<void>((resolve) => current.close(() => resolve()));
    }
    if (!this.simulation) this.state = { ...this.state, status: "DISCONNECTED", activePort: null };
    this.options.onStateChange();
  }

  async setSimulation(connected: boolean): Promise<void> {
    if (connected) {
      this.simulation = true;
      await this.disconnect();
      this.state = { ...this.state, status: "SIMULATION", activePort: null, error: null };
    } else {
      this.simulation = false;
      this.state = { ...this.state, status: "DISCONNECTED", activePort: null };
    }
    this.options.onStateChange();
  }

  sendFeedback(feedback: ArduinoFeedback): void {
    const line = JSON.stringify(feedback);
    this.state.lastFeedback = line;
    if (this.port?.isOpen) this.port.write(`${line}\n`);
    this.options.onStateChange();
  }

  recordSimulatedFeedback(kind: "LED" | "SERVO"): void {
    this.state.lastFeedback = `${kind} feedback acknowledged`;
    this.options.onStateChange();
  }

  private handleLine(line: string): void {
    if (!line) return;
    this.state.lastMessage = line;
    const message = parseArduinoLine(line);
    if (!message) {
      this.state.error = "Malformed Arduino JSON ignored";
      this.options.onStateChange();
      return;
    }
    this.state.error = null;
    const action = arduinoMessageToAction(message);
    if (action) this.options.onAction(action);
    this.options.onStateChange();
  }
}
