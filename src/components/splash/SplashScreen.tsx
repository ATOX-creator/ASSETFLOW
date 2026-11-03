"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SplashScreen.module.css";

type SplashScreenProps = {
  /** Minimum time (ms) the splash stays visible so the animation can play. */
  minDuration?: number;
  /** Keep false while your app is loading; the splash leaves once it is true. */
  ready?: boolean;
  /** Called after the exit animation has finished. */
  onDone?: () => void;
};

export default function SplashScreen({
  minDuration = 3000,
  ready = true,
  onDone,
}: SplashScreenProps) {
  const [minElapsed, setMinElapsed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // wait for the minimum duration
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(t);
  }, [minDuration]);

  // leave when both the minimum time has passed and the app is ready
  useEffect(() => {
    if (!minElapsed || !ready) return;
    setLeaving(true);
    const t = setTimeout(() => {
      setGone(true);
      onDoneRef.current?.();
    }, 700);
    return () => clearTimeout(t);
  }, [minElapsed, ready]);

  // lock page scroll while the splash is visible
  useEffect(() => {
    if (gone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [gone]);

  if (gone) return null;

  return (
    <div
      className={`${styles.root} ${leaving ? styles.leave : ""}`}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="297 297 430 430" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="splash-grad" gradientUnits="userSpaceOnUse" x1="330" y1="320" x2="700" y2="700">
            <stop offset="0" stopColor="#00c8ff" />
            <stop offset=".5" stopColor="#1e8fff" />
            <stop offset="1" stopColor="#4a3dff" />
          </linearGradient>
          <linearGradient id="splash-scan" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#00c8ff" stopOpacity="0" />
            <stop offset=".5" stopColor="#00c8ff" />
            <stop offset="1" stopColor="#4a3dff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="splash-trail" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1e8fff" stopOpacity="0" />
            <stop offset="1" stopColor="#1e8fff" stopOpacity=".28" />
          </linearGradient>
          <clipPath id="splash-clip">
            <rect x="389" y="389" width="246" height="246" />
          </clipPath>
        </defs>

        <g className={styles.logo} fill="url(#splash-grad)">
          {/* corner brackets */}
          <path className={`${styles.br} ${styles.tl}`} d="M317 398V332a14 14 0 0 1 14-14H397V331H333a2 2 0 0 0-2 2V398Z" />
          <path className={`${styles.br} ${styles.tr}`} d="M707 398V332a14 14 0 0 0-14-14H627V331H691a2 2 0 0 1 2 2V398Z" />
          <path className={`${styles.br} ${styles.bl}`} d="M317 626V692a14 14 0 0 0 14 14H397V693H333a2 2 0 0 1-2-2V626Z" />
          <path className={`${styles.br} ${styles.brr}`} d="M707 626V692a14 14 0 0 1-14 14H627V693H691a2 2 0 0 0 2-2V626Z" />

          {/* main frame, with the gap at the top */}
          <path
            className={styles.frame}
            pathLength={1}
            stroke="url(#splash-grad)"
            d="M498 369H369V655H655V369H526"
          />

          {/* inner corner squares */}
          <path className={`${styles.sq} ${styles.s1}`} d="M389 389H413V403a10 10 0 0 1-10 10H389Z" />
          <path className={`${styles.sq} ${styles.s2}`} d="M634 389H610V403a10 10 0 0 0 10 10H634Z" />
          <path className={`${styles.sq} ${styles.s3}`} d="M389 634H413V620a10 10 0 0 0-10-10H389Z" />
          <path className={`${styles.sq} ${styles.s4}`} d="M634 634H610V620a10 10 0 0 1 10-10H634Z" />

          {/* center glyph: outline draws, then fills */}
          <path
            className={styles.gLine}
            pathLength={1}
            stroke="url(#splash-grad)"
            d="M460 441H564A18 18 0 0 1 582 459V522H542V481H481V542H530L568 582H460A18 18 0 0 1 442 564V459A18 18 0 0 1 460 441Z"
          />
          <path
            className={styles.gFill}
            d="M460 441H564A18 18 0 0 1 582 459V522H542V481H481V542H530L568 582H460A18 18 0 0 1 442 564V459A18 18 0 0 1 460 441Z"
          />

          {/* scanner sweep */}
          <g clipPath="url(#splash-clip)">
            <g className={styles.scan}>
              <rect x="389" y="-30" width="246" height="30" fill="url(#splash-trail)" />
              <rect x="389" y="-1.5" width="246" height="3" fill="url(#splash-scan)" />
            </g>
          </g>
        </g>
      </svg>

      <div className={styles.bar}>
        <span />
      </div>
    </div>
  );
}
