import { describe, expect, it } from "vitest";
import { inspectHandModelBundle } from "./handModelAsset";

const modelSized = (header: number[]) => {
  const bytes = new Uint8Array(1_000_001);
  bytes.set(header);
  return bytes;
};

describe("hand model bundle validation", () => {
  it("accepts an ordinary ZIP signature", () => {
    expect(inspectHandModelBundle(modelSized([0x50, 0x4b, 0x03, 0x04]))).toEqual({
      valid: true,
      signatureOffset: 0,
      reason: "OK",
    });
  });

  it("accepts the official MediaPipe task prefix before the ZIP payload", () => {
    expect(inspectHandModelBundle(modelSized([0x00, 0x00, 0x50, 0x4b, 0x03, 0x04]))).toEqual({
      valid: true,
      signatureOffset: 2,
      reason: "OK",
    });
  });

  it("rejects truncated and unrelated assets", () => {
    expect(inspectHandModelBundle(new Uint8Array([0x50, 0x4b]))).toMatchObject({ valid: false, reason: "TOO_SMALL" });
    expect(inspectHandModelBundle(modelSized([0x12, 0x34, 0x56]))).toMatchObject({
      valid: false,
      reason: "MISSING_CONTAINER_SIGNATURE",
    });
  });
});
