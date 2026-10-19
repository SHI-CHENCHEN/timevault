import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { HandMirrorStatus, HandMirrorVisualState } from "../visual/types";

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
] as const;

export function CameraBackdrop({
  enabled,
  status,
  videoRef,
  visualRef,
  debug,
  preview = false,
}: {
  enabled: boolean;
  status: HandMirrorStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  visualRef: MutableRefObject<HandMirrorVisualState>;
  debug: boolean;
  preview?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    const render = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const visual = visualRef.current;
      const drawPresence = (
        detected: boolean,
        x: number,
        y: number,
        palmSize: number,
        color: string,
        label: string,
      ) => {
        if (!detected) return;
        const px = x * width;
        const py = y * height;
        const radius = Math.max(30, Math.min(88, 28 + palmSize * 58));
        context.save();
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 1;
        context.setLineDash([3, 8]);
        context.beginPath();
        context.arc(px, py, radius, -Math.PI * 0.2, Math.PI * 1.46);
        context.stroke();
        context.setLineDash([]);
        context.globalAlpha = 0.68;
        context.beginPath();
        context.arc(px, py, 3.2, 0, Math.PI * 2);
        context.fill();
        context.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
        context.letterSpacing = "0.18em";
        context.fillText(label, px + radius + 8, py + 3);
        context.restore();
      };

      if (visual.leftDetected && visual.rightDetected) {
        context.save();
        context.strokeStyle = "rgba(170, 148, 218, 0.2)";
        context.lineWidth = 0.75;
        context.setLineDash([2, 10]);
        context.beginPath();
        context.moveTo(visual.leftPalmX * width, visual.leftPalmY * height);
        context.lineTo(visual.rightPalmX * width, visual.rightPalmY * height);
        context.stroke();
        context.restore();
      }
      drawPresence(visual.leftDetected, visual.leftPalmX, visual.leftPalmY, visual.leftPalmSize, "rgba(185, 151, 244, 0.7)", "LEFT / PUSH");
      drawPresence(visual.rightDetected, visual.rightPalmX, visual.rightPalmY, visual.rightPalmSize, "rgba(168, 184, 224, 0.65)", "RIGHT / FIELD");

      if (!debug) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      const draw = (points: Float32Array, color: string) => {
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 0.75;
        for (const [from, to] of CONNECTIONS) {
          const x1 = points[from * 2];
          const y1 = points[from * 2 + 1];
          const x2 = points[to * 2];
          const y2 = points[to * 2 + 1];
          if (x1 < 0 || x2 < 0) continue;
          context.beginPath();
          context.moveTo(x1 * width, y1 * height);
          context.lineTo(x2 * width, y2 * height);
          context.stroke();
        }
        for (let index = 0; index < 21; index += 1) {
          const x = points[index * 2];
          const y = points[index * 2 + 1];
          if (x < 0) continue;
          context.beginPath();
          context.arc(x * width, y * height, 1.6, 0, Math.PI * 2);
          context.fill();
        }
      };
      draw(visualRef.current.debugLeft, "rgba(190, 165, 255, 0.7)");
      draw(visualRef.current.debugRight, "rgba(170, 190, 230, 0.62)");
      frame = window.requestAnimationFrame(render);
    };
    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, [debug, enabled, visualRef]);

  return (
    <div
      className={`camera-backdrop ${enabled ? "camera-backdrop--active" : ""} ${preview ? "camera-backdrop--guide" : ""} camera-backdrop--${status.toLowerCase()}`}
      aria-hidden="true"
    >
      <video ref={videoRef} autoPlay muted playsInline />
      <div className="camera-backdrop__veil" />
      <canvas ref={canvasRef} className={`camera-backdrop__debug ${enabled ? "is-active" : ""} ${debug ? "is-debug-visible" : ""}`} />
    </div>
  );
}
