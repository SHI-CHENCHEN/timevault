export interface HandModelBundleInspection {
  valid: boolean;
  signatureOffset: number;
  reason: "OK" | "TOO_SMALL" | "MISSING_CONTAINER_SIGNATURE";
}

const MINIMUM_MODEL_BYTES = 1_000_000;
const SIGNATURE_SEARCH_BYTES = 32;

/**
 * MediaPipe task bundles can contain a short container prefix before the ZIP
 * payload. The official hand landmarker currently places PK at byte 2, so a
 * strict byte-zero check incorrectly rejects a valid model.
 */
export function inspectHandModelBundle(bytes: Uint8Array): HandModelBundleInspection {
  if (bytes.byteLength < MINIMUM_MODEL_BYTES) {
    return { valid: false, signatureOffset: -1, reason: "TOO_SMALL" };
  }

  const searchLimit = Math.min(bytes.byteLength - 1, SIGNATURE_SEARCH_BYTES);
  for (let index = 0; index < searchLimit; index += 1) {
    if (bytes[index] === 0x50 && bytes[index + 1] === 0x4b) {
      return { valid: true, signatureOffset: index, reason: "OK" };
    }
  }

  return { valid: false, signatureOffset: -1, reason: "MISSING_CONTAINER_SIGNATURE" };
}
