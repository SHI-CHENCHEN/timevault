import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { DEFAULT_CONFIG } from "@timevault/shared";
import type {
  CountdownState,
  InputSource,
  InstallationSettings,
  TimeAccount,
  TimeFragment,
  TimeTransaction,
  TransactionType,
} from "@timevault/shared";
import { allocateFragmentsForRecovery, buildConsolidationPlan, getReserveComposition } from "./fragments";

interface AccountRow {
  time_reserve: number;
  total_sold: number;
  total_recovered: number;
  total_transactions: number;
  largest_accumulated_block: number;
}

interface TransactionRow {
  id: string;
  type: TransactionType;
  minutes: number;
  timestamp: string;
  time_reserve_before: number;
  time_reserve_after: number;
  demo_mode: number;
  input_source: InputSource;
  status: TimeTransaction["status"];
}

interface FragmentRow {
  id: string;
  source_transaction_id: string;
  minutes: 5;
  created_at: string;
  state: TimeFragment["state"];
  cluster_id: string | null;
  recovered_by_transaction_id: string | null;
}

interface CountdownRow {
  transaction_id: string;
  total_seconds: number;
  started_at: string;
  ends_at: string;
  multiplier: number;
  demo_mode: number;
  status: "ACTIVE" | "COMPLETED";
}

function transactionFromRow(row: TransactionRow): TimeTransaction {
  return {
    id: row.id,
    type: row.type,
    minutes: row.minutes,
    timestamp: row.timestamp,
    timeReserveBefore: row.time_reserve_before,
    timeReserveAfter: row.time_reserve_after,
    demoMode: Boolean(row.demo_mode),
    inputSource: row.input_source,
    status: row.status,
  };
}

function fragmentFromRow(row: FragmentRow): TimeFragment {
  return {
    id: row.id,
    sourceTransactionId: row.source_transaction_id,
    minutes: row.minutes,
    createdAt: row.created_at,
    state: row.state,
    clusterId: row.cluster_id,
    recoveredByTransactionId: row.recovered_by_transaction_id,
  };
}

export class TimeVaultDatabase {
  private readonly db: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        time_reserve INTEGER NOT NULL DEFAULT 0,
        total_sold INTEGER NOT NULL DEFAULT 0,
        total_recovered INTEGER NOT NULL DEFAULT 0,
        total_transactions INTEGER NOT NULL DEFAULT 0,
        largest_accumulated_block INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO account (id) VALUES (1);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('SELL', 'BUY')),
        minutes INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        time_reserve_before INTEGER NOT NULL,
        time_reserve_after INTEGER NOT NULL,
        demo_mode INTEGER NOT NULL,
        input_source TEXT NOT NULL CHECK (input_source IN ('MOUSE', 'ARDUINO', 'MIXED')),
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fragments (
        id TEXT PRIMARY KEY,
        source_transaction_id TEXT NOT NULL REFERENCES transactions(id),
        minutes INTEGER NOT NULL DEFAULT 5,
        created_at TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('LOOSE', 'CLUSTERED', 'CONSOLIDATED', 'RECOVERED')),
        cluster_id TEXT,
        recovered_by_transaction_id TEXT REFERENCES transactions(id)
      );
      CREATE INDEX IF NOT EXISTS fragments_active_idx ON fragments(state, created_at);

      CREATE TABLE IF NOT EXISTS countdowns (
        transaction_id TEXT PRIMARY KEY REFERENCES transactions(id),
        total_seconds INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        multiplier REAL NOT NULL,
        demo_mode INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const insert = this.db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    insert.run("demoMode", "false");
    insert.run("demoTimeMultiplier", String(DEFAULT_CONFIG.demoTimeMultiplier));
    insert.run("showCurrency", String(DEFAULT_CONFIG.showCurrency));
    insert.run("timeValuePerMinute", String(DEFAULT_CONFIG.timeValuePerMinute));
  }

  getAccount(): TimeAccount {
    const row = this.db.prepare("SELECT * FROM account WHERE id = 1").get() as AccountRow;
    const fragmentCount = (this.db.prepare("SELECT COUNT(*) AS count FROM fragments WHERE state != 'RECOVERED'").get() as { count: number }).count;
    return {
      timeReserve: row.time_reserve,
      totalSold: row.total_sold,
      totalRecovered: row.total_recovered,
      totalTransactions: row.total_transactions,
      fragmentCount,
      largestAccumulatedBlock: row.largest_accumulated_block,
    };
  }

  getSettings(exhibitionMode: boolean): InstallationSettings {
    const rows = this.db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
    const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      demoMode: values.demoMode === "true",
      demoTimeMultiplier: Math.max(1, Number(values.demoTimeMultiplier) || DEFAULT_CONFIG.demoTimeMultiplier),
      showCurrency: values.showCurrency === "true",
      timeValuePerMinute: Number(values.timeValuePerMinute) || DEFAULT_CONFIG.timeValuePerMinute,
      exhibitionMode,
    };
  }

  setSetting(key: "demoMode" | "demoTimeMultiplier", value: boolean | number): void {
    this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
  }

  getFragments(): TimeFragment[] {
    const rows = this.db.prepare("SELECT * FROM fragments ORDER BY created_at, id").all() as FragmentRow[];
    return rows.map(fragmentFromRow);
  }

  getComposition() {
    return getReserveComposition(this.getFragments());
  }

  private consolidateFragments(): void {
    const active = this.db
      .prepare("SELECT id FROM fragments WHERE state != 'RECOVERED' ORDER BY created_at, id")
      .all() as Array<{ id: string }>;
    const plan = buildConsolidationPlan(active.map((row) => row.id));
    const update = this.db.prepare("UPDATE fragments SET state = ?, cluster_id = ? WHERE id = ?");
    for (const assignment of plan) update.run(assignment.state, assignment.clusterId, assignment.fragmentId);
  }

  sell(minutes: number, inputSource: InputSource, demoMode: boolean): TimeTransaction {
    return this.db.transaction(() => {
      const account = this.getAccount();
      const id = randomUUID();
      const timestamp = new Date().toISOString();
      const after = account.timeReserve + minutes;
      this.db.prepare(`
        INSERT INTO transactions
          (id, type, minutes, timestamp, time_reserve_before, time_reserve_after, demo_mode, input_source, status)
        VALUES (?, 'SELL', ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(id, minutes, timestamp, account.timeReserve, after, Number(demoMode), inputSource);

      const insertFragment = this.db.prepare(`
        INSERT INTO fragments
          (id, source_transaction_id, minutes, created_at, state, cluster_id, recovered_by_transaction_id)
        VALUES (?, ?, 5, ?, 'LOOSE', NULL, NULL)
      `);
      for (let index = 0; index < minutes / 5; index += 1) {
        insertFragment.run(randomUUID(), id, timestamp);
      }
      this.db.prepare(`
        UPDATE account SET
          time_reserve = ?,
          total_sold = total_sold + ?,
          total_transactions = total_transactions + 1,
          largest_accumulated_block = MAX(largest_accumulated_block, ?)
        WHERE id = 1
      `).run(after, minutes, after);
      this.consolidateFragments();
      return this.getTransaction(id)!;
    })();
  }

  buy(minutes: number, inputSource: InputSource, settings: InstallationSettings): TimeTransaction {
    return this.db.transaction(() => {
      const account = this.getAccount();
      if (account.timeReserve < minutes) throw new Error("INSUFFICIENT TIME RESERVE");
      const id = randomUUID();
      const timestamp = new Date().toISOString();
      const after = account.timeReserve - minutes;
      this.db.prepare(`
        INSERT INTO transactions
          (id, type, minutes, timestamp, time_reserve_before, time_reserve_after, demo_mode, input_source, status)
        VALUES (?, 'BUY', ?, ?, ?, ?, ?, ?, 'COUNTDOWN')
      `).run(id, minutes, timestamp, account.timeReserve, after, Number(settings.demoMode), inputSource);

      const allocated = allocateFragmentsForRecovery(this.getFragments(), minutes);
      const recover = this.db.prepare(`
        UPDATE fragments SET state = 'RECOVERED', cluster_id = NULL, recovered_by_transaction_id = ? WHERE id = ?
      `);
      for (const fragment of allocated) recover.run(id, fragment.id);

      this.db.prepare(`
        UPDATE account SET
          time_reserve = ?,
          total_recovered = total_recovered + ?,
          total_transactions = total_transactions + 1
        WHERE id = 1
      `).run(after, minutes);
      this.consolidateFragments();

      const totalSeconds = minutes * 60;
      const multiplier = settings.demoMode ? settings.demoTimeMultiplier : 1;
      const endTime = new Date(Date.now() + (totalSeconds / multiplier) * 1000);
      this.db.prepare(`
        INSERT INTO countdowns
          (transaction_id, total_seconds, started_at, ends_at, multiplier, demo_mode, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
      `).run(id, totalSeconds, timestamp, endTime.toISOString(), multiplier, Number(settings.demoMode));
      return this.getTransaction(id)!;
    })();
  }

  getTransaction(id: string): TimeTransaction | null {
    const row = this.db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as TransactionRow | undefined;
    return row ? transactionFromRow(row) : null;
  }

  getHistory(limit = 100): TimeTransaction[] {
    const rows = this.db.prepare("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?").all(limit) as TransactionRow[];
    return rows.map(transactionFromRow);
  }

  getTodayFragmentedMinutes(): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(minutes), 0) AS total FROM transactions
      WHERE type = 'SELL' AND status != 'FAILED' AND date(timestamp, 'localtime') = date('now', 'localtime')
    `).get() as { total: number };
    return row.total;
  }

  getActiveCountdown(): CountdownState | null {
    const row = this.db.prepare("SELECT * FROM countdowns WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1").get() as CountdownRow | undefined;
    if (!row) return null;
    const remainingRealSeconds = (new Date(row.ends_at).getTime() - Date.now()) / 1000;
    return {
      transactionId: row.transaction_id,
      totalSeconds: row.total_seconds,
      remainingSeconds: Math.max(0, Math.ceil(remainingRealSeconds * row.multiplier)),
      startedAt: row.started_at,
      endsAt: row.ends_at,
      multiplier: row.multiplier,
      demoMode: Boolean(row.demo_mode),
    };
  }

  completeCountdown(transactionId: string): void {
    this.db.transaction(() => {
      this.db.prepare("UPDATE countdowns SET status = 'COMPLETED' WHERE transaction_id = ?").run(transactionId);
      this.db.prepare("UPDATE transactions SET status = 'COMPLETED' WHERE id = ?").run(transactionId);
    })();
  }

  reset(): void {
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM countdowns").run();
      this.db.prepare("DELETE FROM fragments").run();
      this.db.prepare("DELETE FROM transactions").run();
      this.db.prepare(`
        UPDATE account SET time_reserve = 0, total_sold = 0, total_recovered = 0,
          total_transactions = 0, largest_accumulated_block = 0 WHERE id = 1
      `).run();
    })();
  }

  close(): void {
    this.db.close();
  }
}
