import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  createInitialInteractionState,
  interactionReducer,
  transactionInputSource,
  withInputSource,
  type CanonicalAction,
  type ClientToServerEvents,
  type CountdownState,
  type InstallationSettings,
  type InstallationSnapshot,
  type ReserveComposition,
  type ReserveStructure,
  type ServerToClientEvents,
  type TimeAccount,
  type TimeOption,
  type TimeTransaction,
} from "@timevault/shared";

type TimeVaultSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface StoredInstallation {
  account: TimeAccount;
  history: TimeTransaction[];
  settings: InstallationSettings;
  countdown: CountdownState | null;
}

const STORAGE_KEY = "timevault.site.installation.v1";
const PROCESSING_HOLD_MS = 2200;
const COMPLETION_HOLD_MS = 4000;

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function seedInstallation(): StoredInstallation {
  const timestamp = new Date().toISOString();
  const transaction: TimeTransaction = {
    id: "site-demo-reserve",
    type: "SELL",
    minutes: 30,
    timestamp,
    timeReserveBefore: 0,
    timeReserveAfter: 30,
    demoMode: true,
    inputSource: "MOUSE",
    status: "COMPLETED",
  };
  return {
    account: {
      timeReserve: 30,
      totalSold: 30,
      totalRecovered: 0,
      totalTransactions: 1,
      fragmentCount: 6,
      largestAccumulatedBlock: 30,
    },
    history: [transaction],
    settings: {
      demoMode: true,
      demoTimeMultiplier: 60,
      showCurrency: false,
      timeValuePerMinute: 1,
      exhibitionMode: true,
    },
    countdown: null,
  };
}

function loadInstallation(): StoredInstallation {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedInstallation();
    const parsed = JSON.parse(raw) as StoredInstallation;
    if (!parsed.account || !Array.isArray(parsed.history) || !parsed.settings) return seedInstallation();
    if (parsed.countdown && new Date(parsed.countdown.endsAt).getTime() <= Date.now()) {
      parsed.history = parsed.history.map((transaction) =>
        transaction.id === parsed.countdown?.transactionId ? { ...transaction, status: "COMPLETED" } : transaction,
      );
      parsed.countdown = null;
    }
    return parsed;
  } catch {
    return seedInstallation();
  }
}

function buildComposition(minutes: number, history: TimeTransaction[]): ReserveComposition {
  const structures: ReserveStructure[] = [];
  const sources = history.filter((transaction) => transaction.type === "SELL").map((transaction) => transaction.id);
  let remaining = minutes;
  const counts = { micro: 0, cluster: 0, shard: 0, major: 0 };
  const add = (kind: ReserveStructure["kind"], blockMinutes: number, index: number) => {
    const key = kind.toLowerCase();
    structures.push({
      id: `site-${key}-${index}`,
      kind,
      minutes: blockMinutes,
      fragmentIds: Array.from({ length: blockMinutes / 5 }, (_, fragmentIndex) => `site-${key}-${index}-${fragmentIndex}`),
      sourceTransactionIds: sources,
    });
  };

  while (remaining >= 60) {
    add("MAJOR", 60, counts.major);
    counts.major += 1;
    remaining -= 60;
  }
  while (remaining >= 30) {
    add("SHARD", 30, counts.shard);
    counts.shard += 1;
    remaining -= 30;
  }
  while (remaining >= 15) {
    add("CLUSTER", 15, counts.cluster);
    counts.cluster += 1;
    remaining -= 15;
  }
  while (remaining >= 5) {
    add("MICRO", 5, counts.micro);
    counts.micro += 1;
    remaining -= 5;
  }

  return { totalMinutes: minutes, structures, counts };
}

function todayFragmented(history: TimeTransaction[]): number {
  const today = new Date().toDateString();
  return history
    .filter((transaction) => transaction.type === "SELL" && new Date(transaction.timestamp).toDateString() === today)
    .reduce((total, transaction) => total + transaction.minutes, 0);
}

export function useStandaloneInstallation() {
  const initial = useRef<StoredInstallation | null>(null);
  if (!initial.current) initial.current = loadInstallation();

  const [account, setAccount] = useState(initial.current.account);
  const [history, setHistory] = useState(initial.current.history);
  const [settings, setSettings] = useState(initial.current.settings);
  const [countdown, setCountdown] = useState(initial.current.countdown);
  const [interaction, setInteraction] = useState(() => {
    if (!initial.current?.countdown) return createInitialInteractionState();
    return {
      ...createInitialInteractionState(),
      currentScreen: "BUYBACK_COUNTDOWN" as const,
      currentMode: "BUY" as const,
      selectedMinutes: (initial.current.countdown.totalSeconds / 60) as TimeOption,
      lastTransactionId: initial.current.countdown.transactionId,
    };
  });
  const completionTimer = useRef<number | null>(null);
  const processingTimer = useRef<number | null>(null);

  const socket = useMemo(() => ({ emit: () => true }) as unknown as TimeVaultSocket, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ account, history, settings, countdown } satisfies StoredInstallation));
  }, [account, history, settings, countdown]);

  useEffect(() => {
    if (!countdown) return;
    const tick = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil(((new Date(countdown.endsAt).getTime() - Date.now()) * countdown.multiplier) / 1000),
      );
      if (remainingSeconds <= 0) {
        setCountdown(null);
        setHistory((current) => current.map((transaction) =>
          transaction.id === countdown.transactionId ? { ...transaction, status: "COMPLETED" } : transaction,
        ));
        setInteraction((current) => interactionReducer(current, { type: "COUNTDOWN_COMPLETE" }));
        completionTimer.current = window.setTimeout(() => setInteraction(createInitialInteractionState()), COMPLETION_HOLD_MS);
        return;
      }
      setCountdown((current) => current ? { ...current, remainingSeconds } : null);
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [countdown?.transactionId, countdown?.endsAt, countdown?.multiplier]);

  useEffect(() => () => {
    if (completionTimer.current) window.clearTimeout(completionTimer.current);
    if (processingTimer.current) window.clearTimeout(processingTimer.current);
  }, []);

  const scheduleIdle = () => {
    if (completionTimer.current) window.clearTimeout(completionTimer.current);
    completionTimer.current = window.setTimeout(() => setInteraction(createInitialInteractionState()), COMPLETION_HOLD_MS);
  };

  const dispatch = useCallback((action: CanonicalAction, source: "MOUSE" | "ARDUINO") => {
    if (action.type === "SET_DEMO_MODE") {
      setSettings((current) => ({ ...current, demoMode: action.value }));
      return;
    }
    if (action.type === "SET_DEMO_MULTIPLIER") {
      setSettings((current) => ({ ...current, demoTimeMultiplier: Math.max(1, Math.min(600, action.value)) }));
      return;
    }

    const sourceBearing = ["SELECT_MODE", "SET_DURATION", "INCREASE_DURATION", "DECREASE_DURATION", "CONFIRM_TRANSACTION"].includes(action.type);
    const before = sourceBearing ? withInputSource(interaction, source) : interaction;

    if (
      action.type === "CONFIRM_TRANSACTION" &&
      before.currentScreen === "CONFIRMATION" &&
      before.currentMode === "BUY" &&
      account.timeReserve < before.selectedMinutes
    ) {
      setInteraction({ ...before, message: "INSUFFICIENT TIME RESERVE" });
      return;
    }

    const next = interactionReducer(before, action);
    setInteraction(next);
    if (next.currentScreen !== "TRANSACTION_PROCESSING" || !next.currentMode) return;
    const mode = next.currentMode;

    processingTimer.current = window.setTimeout(() => {
      const minutes = next.selectedMinutes;
      const timestamp = new Date().toISOString();
      const transactionId = createId(mode.toLowerCase());
      const inputSource = transactionInputSource(next);
      const reserveBefore = account.timeReserve;
      const reserveAfter = mode === "SELL" ? reserveBefore + minutes : reserveBefore - minutes;
      const transaction: TimeTransaction = {
        id: transactionId,
        type: mode,
        minutes,
        timestamp,
        timeReserveBefore: reserveBefore,
        timeReserveAfter: reserveAfter,
        demoMode: settings.demoMode,
        inputSource,
        status: mode === "BUY" ? "COUNTDOWN" : "COMPLETED",
      };

      setAccount((current) => ({
        timeReserve: reserveAfter,
        totalSold: current.totalSold + (mode === "SELL" ? minutes : 0),
        totalRecovered: current.totalRecovered + (mode === "BUY" ? minutes : 0),
        totalTransactions: current.totalTransactions + 1,
        fragmentCount: reserveAfter / 5,
        largestAccumulatedBlock: Math.max(current.largestAccumulatedBlock, reserveAfter),
      }));
      setHistory((current) => [transaction, ...current]);

      if (mode === "SELL") {
        setInteraction({ ...next, currentScreen: "TRANSACTION_COMPLETE", message: "TIME STORED", lastTransactionId: transactionId });
        scheduleIdle();
        return;
      }

      const multiplier = settings.demoMode ? settings.demoTimeMultiplier : 1;
      const totalSeconds = minutes * 60;
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + (totalSeconds / multiplier) * 1000);
      setCountdown({
        transactionId,
        totalSeconds,
        remainingSeconds: totalSeconds,
        startedAt: startedAt.toISOString(),
        endsAt: endsAt.toISOString(),
        multiplier,
        demoMode: settings.demoMode,
      });
      setInteraction({ ...next, currentScreen: "BUYBACK_COUNTDOWN", message: null, lastTransactionId: transactionId });
    }, PROCESSING_HOLD_MS);
  }, [account, interaction, settings]);

  const snapshot: InstallationSnapshot = {
    interaction,
    account,
    composition: buildComposition(account.timeReserve, history),
    countdown,
    settings,
    hardware: {
      status: "SIMULATION",
      activePort: null,
      availablePorts: [],
      lastMessage: null,
      lastFeedback: null,
      error: null,
    },
    storage: { status: "PERSISTENT", error: null },
    history,
    todayFragmentedMinutes: todayFragmented(history),
    serverTime: new Date().toISOString(),
  };

  return {
    socket,
    snapshot,
    connected: true,
    notice: null,
    action: (action: CanonicalAction) => dispatch(action, "MOUSE"),
    simulate: (action: CanonicalAction) => dispatch(action, "ARDUINO"),
  };
}
