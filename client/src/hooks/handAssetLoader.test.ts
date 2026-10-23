import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadHandAsset, HAND_ASSET_IDLE_MS, loadHandAssets } from "./handAssetLoader";

vi.mock("@mediapipe/tasks-vision", () => ({ FilesetResolver: { forVisionTasks: async (path: string) => ({ wasmBinaryPath: `${path}/vision.wasm`, wasmLoaderPath: `${path}/vision.js` }) } }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("hand runtime downloads", () => {
  it("keeps progressing transfers alive beyond the previous model deadline", async () => {
    vi.useFakeTimers();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { "content-length": "3" } })));
    const progress = vi.fn();
    const result = downloadHandAsset("/model", "MODEL", new AbortController().signal, progress);
    await vi.advanceTimersByTimeAsync(20_000); stream.enqueue(new Uint8Array([1]));
    await vi.advanceTimersByTimeAsync(40_000); stream.enqueue(new Uint8Array([2]));
    await vi.advanceTimersByTimeAsync(40_000); stream.enqueue(new Uint8Array([3])); stream.close();
    expect(await result).toEqual(new Uint8Array([1, 2, 3]));
    expect(progress).toHaveBeenLastCalledWith({ label: "MODEL", loaded: 3, total: 3 });
    expect(fetch).toHaveBeenCalledWith("/model", expect.objectContaining({ cache: "force-cache" }));
  });

  it("aborts a truly stalled transfer and reports a recoverable download error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const result = downloadHandAsset("/model", "MODEL", new AbortController().signal, vi.fn());
    const rejected = expect(result).rejects.toThrow("HAND ASSET STALLED");
    await vi.advanceTimersByTimeAsync(HAND_ASSET_IDLE_MS); await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a partial body immediately on Stop or page exit", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => Promise.resolve(new Response(new ReadableStream({ start(controller) { init.signal?.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError"))); controller.enqueue(new Uint8Array([1])); } }))));
    const abort = new AbortController();
    const result = downloadHandAsset("/model", "MODEL", abort.signal, vi.fn());
    const rejected = expect(result).rejects.toThrow("SESSION_CANCELLED");
    await Promise.resolve(); await Promise.resolve(); abort.abort(); await rejected;
  });

  it("reports missing hosted assets rather than feeding HTML into the model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(downloadHandAsset("/bad", "MODEL", new AbortController().signal, vi.fn())).rejects.toThrow("HTTP 404");
  });

  it("prepares matching WASM before initialization and revokes session URLs once", async () => {
    const model = new Uint8Array(1_000_001); model[2] = 0x50; model[3] = 0x4b;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.includes("model") ? model : url.endsWith(".wasm") ? new Uint8Array([0, 0x61, 0x73, 0x6d]) : "local runtime")));
    const create = vi.spyOn(URL, "createObjectURL"); const revoke = vi.spyOn(URL, "revokeObjectURL");
    const assets = await loadHandAssets("/model", "/timevault/mediapipe", new AbortController().signal, vi.fn());
    expect(create).toHaveBeenCalledTimes(2);
    expect(assets.vision.wasmBinaryPath).toMatch(/^blob:/);
    expect(assets.vision.wasmLoaderPath).toMatch(/^blob:/);
    expect(assets.model).toEqual(model);
    assets.dispose(); assets.dispose();
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed models before creating any runtime URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>proxy error</html>")));
    const create = vi.spyOn(URL, "createObjectURL");
    await expect(loadHandAssets("/model", "/mediapipe", new AbortController().signal, vi.fn())).rejects.toThrow("INVALID MODEL");
    expect(create).not.toHaveBeenCalled();
  });
});
