"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SEEN_KEY = "af.splash.seen";
const FADE_MS = 350;

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) {
        return;
      }
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // sessionStorage unavailable (private mode) — play once per mount
    }
    setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) {
      return;
    }
    dismissedRef.current = true;
    setFading(true);
    window.setTimeout(() => setVisible(false), FADE_MS);
  }, []);

  const handlePlay = useCallback(() => {
    void videoRef.current?.play().catch(() => dismiss());
  }, [dismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Skip intro"
      onClick={dismiss}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
          event.preventDefault();
          dismiss();
        }
      }}
      className={`fixed inset-0 z-[120] cursor-pointer bg-app transition-opacity duration-[350ms] ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onCanPlay={handlePlay}
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
