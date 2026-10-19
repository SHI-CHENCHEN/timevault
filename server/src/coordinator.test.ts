import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { InstallationCoordinator } from "./coordinator";
import { TimeVaultDatabase } from "./database";

describe("installation coordinator", () => {
  it("keeps an overdrawn BUY in confirmation with a restrained message", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "timevault-coordinator-"));
    const database = new TimeVaultDatabase(path.join(directory, "test.sqlite"));
    const coordinator = new InstallationCoordinator(database);

    coordinator.dispatch({ type: "SELECT_MODE", value: "BUY" }, "MOUSE");
    coordinator.dispatch({ type: "SET_DURATION", value: 60 }, "MOUSE");
    coordinator.dispatch({ type: "CONFIRM_TRANSACTION" }, "MOUSE");
    coordinator.dispatch({ type: "CONFIRM_TRANSACTION" }, "MOUSE");

    expect(coordinator.getSnapshot().interaction).toMatchObject({
      currentScreen: "CONFIRMATION",
      message: "INSUFFICIENT TIME RESERVE",
    });
    expect(database.getHistory()).toHaveLength(0);
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
