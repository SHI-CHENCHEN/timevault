export interface CameraIssue {
  code: string;
  message: string;
  recovery: string;
}

export function cameraSupportIssue(support: { secure: boolean; media: boolean; wasm: boolean; policy: boolean }): CameraIssue | null {
  if (!support.secure) return { code: "HTTPS_REQUIRED", message: "Camera interaction needs HTTPS or localhost.", recovery: "Open the public HTTPS link directly in your browser." };
  if (!support.policy) return { code: "CAMERA_POLICY", message: "This embedded page is not allowed to use the camera.", recovery: "Open TIMEVAULT in a separate browser tab, outside the embedded preview." };
  if (!support.media) return { code: "CAMERA_API", message: "This browser does not expose a camera API.", recovery: "Open the link in a full, up-to-date Chrome, Edge or Safari browser instead of an in-app browser." };
  if (!support.wasm) return { code: "WASM_UNAVAILABLE", message: "This browser cannot run the local hand model.", recovery: "Use a browser with WebAssembly enabled. Manual controls remain available." };
  return null;
}

export function cameraErrorIssue(error: unknown): CameraIssue {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : String(error);
  if (message === "CAMERA REQUEST TIMED OUT") return { code: "CAMERA_PERMISSION_WAIT", message: "The browser did not complete the camera request.", recovery: "Check the browser's permission prompt. Allow Camera for this page, keep the tab visible and select Retry." };
  if (name === "NotAllowedError" || name === "SecurityError") return { code: "CAMERA_DENIED", message: "Camera permission was not granted.", recovery: "Allow Camera for this site in the address bar, and allow this browser in your operating system's camera settings; then retry." };
  if (name === "NotFoundError") return { code: "NO_CAMERA", message: "No usable camera was found.", recovery: "Connect a camera and reopen the page, or use manual controls." };
  if (name === "NotReadableError" || name === "AbortError") return { code: "CAMERA_BUSY", message: "The camera could not be read.", recovery: "Close other camera apps or tabs, check the system camera permission, then retry." };
  if (name === "OverconstrainedError") return { code: "CAMERA_FORMAT", message: "The requested camera format is unavailable.", recovery: "Try a different camera, or reopen this link in your full browser." };
  if (/CAMERA|VIDEO|FRAME/.test(message)) return { code: "VIDEO_NOT_READY", message: "The camera opened, but usable video frames stopped or did not arrive.", recovery: "Keep this tab visible, close other camera apps and retry. No video is uploaded." };
  return { code: "MODEL_START", message: "The local hand model could not start.", recovery: "Check the network, reload this HTTPS page and retry. Camera access alone does not mean recognition is running." };
}

/** Close a resource that resolves after stop/timeout; never attach it to a new session. */
export async function acquireSessionResource<T>(promise: Promise<T>, timeoutMs: number, label: string, current: () => boolean, dispose: (resource: T) => void): Promise<T> {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watched = promise.then((resource) => {
    if (expired || !current()) {
      dispose(resource);
      throw new Error("SESSION_CANCELLED");
    }
    return resource;
  });
  try {
    return await Promise.race([watched, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(new Error(label)); }, timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
