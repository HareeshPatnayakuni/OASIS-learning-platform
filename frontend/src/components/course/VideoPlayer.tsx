'use client';

import { useEffect, useRef } from 'react';

const PROGRESS_SAVE_INTERVAL_SEC = 10;

interface VideoPlayerProps {
  src: string;
  title: string;
  startAtSec?: number;
  onProgress: (positionSec: number) => void;
  onCompleted: () => void;
}

/**
 * A plain HTML5 <video> element — no custom player library. The signed URL
 * (from GET /lectures/:id/stream-url) is short-lived (10 minutes,
 * lib/r2.ts on the backend); this component doesn't try to refresh it
 * mid-playback, since a 10-minute window comfortably covers a single
 * lecture-watching session. If a student's session genuinely runs long
 * enough to expire it, reloading the page fetches a fresh one.
 */
export function VideoPlayer({ src, title, startAtSec = 0, onProgress, onCompleted }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);
  const hasSeekedRef = useRef(false);

  useEffect(() => {
    hasSeekedRef.current = false;
    lastSavedRef.current = startAtSec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function handleLoadedMetadata(): void {
    const video = videoRef.current;
    if (!video || hasSeekedRef.current) return;
    if (startAtSec > 0 && startAtSec < video.duration) {
      video.currentTime = startAtSec;
    }
    hasSeekedRef.current = true;
  }

  function handleTimeUpdate(): void {
    const video = videoRef.current;
    if (!video) return;
    const current = Math.floor(video.currentTime);
    if (current - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL_SEC) {
      lastSavedRef.current = current;
      onProgress(current);
    }
  }

  function handlePause(): void {
    const video = videoRef.current;
    if (!video) return;
    // Always save on pause, even if the throttle interval hasn't elapsed —
    // a student who watches 8 seconds and closes the tab shouldn't lose
    // that on "resume".
    const current = Math.floor(video.currentTime);
    if (current !== lastSavedRef.current) {
      lastSavedRef.current = current;
      onProgress(current);
    }
  }

  function handleEnded(): void {
    onCompleted();
  }

  return (
    <video
      ref={videoRef}
      key={src}
      src={src}
      controls
      className="aspect-video w-full rounded-xl bg-black"
      aria-label={title}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={handleTimeUpdate}
      onPause={handlePause}
      onEnded={handleEnded}
    />
  );
}
