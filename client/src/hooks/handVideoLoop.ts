/** Poll the playing video independently of requestVideoFrameCallback. Some
 * embedded browsers expose that API but stop delivering its callbacks. */
export function startHandVideoLoop(onFrame: (now: number) => void, request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window)): () => void {
  let stopped = false;
  let frame: number;
  const tick = (now: number) => {
    if (stopped) return;
    frame = request(tick);
    onFrame(now);
  };
  frame = request(tick);
  return () => { stopped = true; cancel(frame); };
}

export function cameraFrameToken(video: Pick<HTMLVideoElement, "currentTime"> & { getVideoPlaybackQuality?: () => Pick<VideoPlaybackQuality, "totalVideoFrames"> }, now: number): number {
  const frames = video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0;
  // A compositor frame counter works even with a frozen/rounded currentTime.
  // Older WebViews expose neither clock until later; the pacer still caps work.
  return frames > 0 ? frames : video.currentTime > 0 ? video.currentTime : now;
}
