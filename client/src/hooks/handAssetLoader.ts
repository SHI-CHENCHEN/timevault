import type { FilesetResolver } from "@mediapipe/tasks-vision";
import { inspectHandModelBundle } from "./handModelAsset";

export type HandVisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export interface HandAssetProgress { label: string; loaded: number; total: number }
export const HAND_ASSET_IDLE_MS = 60_000;

/** A slow, progressing download is healthy. Only a stalled transfer times out. */
export async function downloadHandAsset(url: string, label: string, signal: AbortSignal, progress: (value: HandAssetProgress) => void): Promise<Uint8Array> {
  const request = new AbortController();
  let stalled = false;
  let timer: ReturnType<typeof setTimeout>;
  const cancel = () => request.abort();
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { stalled = true; request.abort(); }, HAND_ASSET_IDLE_MS);
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) request.abort();
  touch();
  try {
    // These are pinned local assets. Reuse the browser cache on Retry/revisit.
    const response = await fetch(url, { cache: "force-cache", signal: request.signal });
    if (!response.ok) throw new Error(`HAND ASSET ${label}: HTTP ${response.status}`);
    const total = Number(response.headers.get("content-length")) || 0;
    let loaded = 0;
    progress({ label, loaded, total });
    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      progress({ label, loaded: bytes.byteLength, total: total || bytes.byteLength });
      return bytes;
    }
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.byteLength;
      touch(); progress({ label, loaded, total });
    }
    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    if (signal.aborted) throw new Error("SESSION_CANCELLED");
    if (stalled) throw new Error(`HAND ASSET STALLED: ${label}`);
    throw new Error(`HAND ASSET ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", cancel);
  }
}

export async function loadHandAssets(modelPath: string, wasmPath: string, signal: AbortSignal, progress: (value: HandAssetProgress) => void) {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) request.abort();
  const urls: string[] = [];
  try {
    const { FilesetResolver } = await import("@mediapipe/tasks-vision");
    if (signal.aborted) throw new Error("SESSION_CANCELLED");
    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    if (signal.aborted) throw new Error("SESSION_CANCELLED");
    // Complete network work before starting the initialization timer. Blob URLs
    // are local to this browser session and contain only public runtime assets.
    const [model, wasm, loader] = await Promise.all([
      downloadHandAsset(modelPath, "HAND MODEL", request.signal, progress),
      downloadHandAsset(vision.wasmBinaryPath, "VISION RUNTIME", request.signal, progress),
      downloadHandAsset(vision.wasmLoaderPath, "RUNTIME LOADER", request.signal, progress),
    ]);
    const inspection = inspectHandModelBundle(model);
    if (!inspection.valid) throw new Error(`HAND ASSET INVALID MODEL: ${inspection.reason}`);
    if (wasm[0] !== 0 || wasm[1] !== 0x61 || wasm[2] !== 0x73 || wasm[3] !== 0x6d) throw new Error("HAND ASSET INVALID WASM");
    if (signal.aborted) throw new Error("SESSION_CANCELLED");
    const blobUrl = (bytes: Uint8Array, type: string) => {
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
      urls.push(url); return url;
    };
    const preparedVision = { ...vision, wasmBinaryPath: blobUrl(wasm, "application/wasm"), wasmLoaderPath: blobUrl(loader, "text/javascript") };
    return { model, vision: preparedVision, dispose: () => urls.splice(0).forEach(url => URL.revokeObjectURL(url)) };
  } catch (error) {
    request.abort();
    urls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
