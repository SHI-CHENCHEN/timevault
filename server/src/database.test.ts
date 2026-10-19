import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TimeVaultDatabase } from "./database";

const temporaryDirectories: string[] = [];

function createDatabase(): TimeVaultDatabase {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "timevault-test-"));
  temporaryDirectories.push(directory);
  return new TimeVaultDatabase(path.join(directory, "test.sqlite"));
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("TIMEVAULT persistence scenarios", () => {
  it("keeps three SELL records but consolidates their 15 minutes", () => {
    const database = createDatabase();
    database.sell(5, "MOUSE", false);
    database.sell(5, "MOUSE", false);
    database.sell(5, "MOUSE", false);

    expect(database.getAccount()).toMatchObject({ timeReserve: 15, totalSold: 15, totalTransactions: 3, fragmentCount: 3 });
    expect(database.getHistory()).toHaveLength(3);
    const composition = database.getComposition();
    expect(composition.counts.cluster).toBe(1);
    expect(composition.structures[0].sourceTransactionIds).toHaveLength(3);
    database.close();
  });

  it("recovers 15 from a 30-minute reserve and starts a demo countdown", () => {
    const database = createDatabase();
    database.sell(30, "MOUSE", false);
    const transaction = database.buy(15, "MIXED", {
      demoMode: true,
      demoTimeMultiplier: 60,
      exhibitionMode: false,
      showCurrency: false,
      timeValuePerMinute: 1,
    });

    expect(database.getAccount()).toMatchObject({ timeReserve: 15, totalRecovered: 15, totalTransactions: 2 });
    expect(transaction).toMatchObject({ type: "BUY", inputSource: "MIXED", status: "COUNTDOWN" });
    expect(database.getFragments().filter((item) => item.state === "RECOVERED")).toHaveLength(3);
    expect(database.getActiveCountdown()).toMatchObject({ totalSeconds: 900, multiplier: 60, demoMode: true });
    database.close();
  });

  it("rejects recovery beyond the available reserve", () => {
    const database = createDatabase();
    database.sell(5, "ARDUINO", false);
    expect(() => database.buy(15, "ARDUINO", database.getSettings(false))).toThrow("INSUFFICIENT TIME RESERVE");
    expect(database.getAccount().timeReserve).toBe(5);
    expect(database.getHistory()).toHaveLength(1);
    database.close();
  });
});
