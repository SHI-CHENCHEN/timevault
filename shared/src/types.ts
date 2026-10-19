import type { TimeOption } from "./constants";

export type InteractionScreen =
  | "IDLE"
  | "MODE_SELECTION"
  | "TIME_SELECTION"
  | "CONFIRMATION"
  | "TRANSACTION_PROCESSING"
  | "TRANSACTION_COMPLETE"
  | "BUYBACK_COUNTDOWN"
  | "BUYBACK_COMPLETE"
  | "HISTORY"
  | "REFLECTION"
  | "SETTINGS";

export type TransactionType = "SELL" | "BUY";
export type InputSource = "MOUSE" | "ARDUINO" | "MIXED";
export type HardwareStatus = "CONNECTED" | "SIMULATION" | "DISCONNECTED";
export type FragmentState = "LOOSE" | "CLUSTERED" | "CONSOLIDATED" | "RECOVERED";
export type ReflectionStep = 0 | 1 | 2;

export type CanonicalAction =
  | { type: "OPEN_MODE_SELECTION" }
  | { type: "SELECT_MODE"; value: TransactionType }
  | { type: "SET_DURATION"; value: TimeOption }
  | { type: "INCREASE_DURATION" }
  | { type: "DECREASE_DURATION" }
  | { type: "CONFIRM_TRANSACTION" }
  | { type: "CANCEL" }
  | { type: "GO_IDLE" }
  | { type: "SHOW_HISTORY" }
  | { type: "SHOW_REFLECTION" }
  | { type: "SET_REFLECTION_STEP"; value: ReflectionStep }
  | { type: "SHOW_SETTINGS" }
  | { type: "SET_DEMO_MODE"; value: boolean }
  | { type: "SET_DEMO_MULTIPLIER"; value: number }
  | { type: "COUNTDOWN_COMPLETE" };

export interface InteractionState {
  currentScreen: InteractionScreen;
  currentMode: TransactionType | null;
  selectedMinutes: TimeOption;
  message: string | null;
  inputSources: Array<Exclude<InputSource, "MIXED">>;
  lastTransactionId: string | null;
  reflectionStep: ReflectionStep;
}

export interface TimeAccount {
  timeReserve: number;
  totalSold: number;
  totalRecovered: number;
  totalTransactions: number;
  fragmentCount: number;
  largestAccumulatedBlock: number;
}

export interface TimeTransaction {
  id: string;
  type: TransactionType;
  minutes: number;
  timestamp: string;
  timeReserveBefore: number;
  timeReserveAfter: number;
  demoMode: boolean;
  inputSource: InputSource;
  status: "COMPLETED" | "COUNTDOWN" | "CANCELLED" | "FAILED";
}

export interface TimeFragment {
  id: string;
  sourceTransactionId: string;
  minutes: 5;
  createdAt: string;
  state: FragmentState;
  clusterId: string | null;
  recoveredByTransactionId: string | null;
}

export interface ReserveStructure {
  id: string;
  kind: "MICRO" | "CLUSTER" | "SHARD" | "MAJOR";
  minutes: number;
  fragmentIds: string[];
  sourceTransactionIds: string[];
}

export interface ReserveComposition {
  totalMinutes: number;
  structures: ReserveStructure[];
  counts: { micro: number; cluster: number; shard: number; major: number };
}

export interface CountdownState {
  transactionId: string;
  totalSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  endsAt: string;
  multiplier: number;
  demoMode: boolean;
}

export interface InstallationSettings {
  demoMode: boolean;
  demoTimeMultiplier: number;
  showCurrency: boolean;
  timeValuePerMinute: number;
  exhibitionMode: boolean;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export interface HardwareState {
  status: HardwareStatus;
  activePort: string | null;
  availablePorts: SerialPortInfo[];
  lastMessage: string | null;
  lastFeedback: string | null;
  error: string | null;
}

export interface StorageState {
  status: "PERSISTENT" | "MEMORY";
  error: string | null;
}

export interface InstallationSnapshot {
  interaction: InteractionState;
  account: TimeAccount;
  composition: ReserveComposition;
  countdown: CountdownState | null;
  settings: InstallationSettings;
  hardware: HardwareState;
  storage: StorageState;
  history: TimeTransaction[];
  todayFragmentedMinutes: number;
  serverTime: string;
}

export interface ArduinoMessage {
  type: "connected" | "mode" | "encoder" | "confirm" | "cancel";
  device?: string;
  value?: "SELL" | "BUY";
  direction?: "CW" | "CCW";
}

export interface ArduinoFeedback {
  type: "feedback";
  state: "SELECT" | "SELL_PROCESSING" | "SELL_COMPLETE" | "BUY_PROCESSING" | "BUY_COUNTDOWN" | "BUY_COMPLETE" | "CANCELLED";
  minutes?: number;
}

export interface ClientToServerEvents {
  action: (action: CanonicalAction) => void;
  request_state: () => void;
  simulator_action: (action: CanonicalAction) => void;
  simulator_connection: (connected: boolean) => void;
  simulator_feedback: (kind: "LED" | "SERVO") => void;
  add_test_reserve: (minutes: number) => void;
  reset_database: () => void;
  refresh_ports: () => void;
  connect_port: (path: string) => void;
  disconnect_port: () => void;
}

export interface ServerToClientEvents {
  state: (snapshot: InstallationSnapshot) => void;
  notice: (message: string) => void;
}
