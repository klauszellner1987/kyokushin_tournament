import { useState, useEffect, useCallback, useRef } from 'react';

function computeRemaining(timerEndsAt?: number, timerPausedRemaining?: number): number {
  if (timerPausedRemaining != null) return timerPausedRemaining;
  if (timerEndsAt != null) return Math.max(0, (timerEndsAt - Date.now()) / 1000);
  return 0;
}

export function useTimer(timerEndsAt?: number, timerPausedRemaining?: number) {
  const [remaining, setRemaining] = useState<number>(
    () => computeRemaining(timerEndsAt, timerPausedRemaining),
  );

  const prevEndsAtRef = useRef(timerEndsAt);
  const prevPausedRef = useRef(timerPausedRemaining);
  if (timerEndsAt !== prevEndsAtRef.current || timerPausedRemaining !== prevPausedRef.current) {
    prevEndsAtRef.current = timerEndsAt;
    prevPausedRef.current = timerPausedRemaining;
    setRemaining(computeRemaining(timerEndsAt, timerPausedRemaining));
  }

  const isPaused = timerPausedRemaining != null;
  const isRunning = timerEndsAt != null && !isPaused;
  const isExpired = isRunning && remaining <= 0 && timerEndsAt != null && timerEndsAt <= Date.now();

  useEffect(() => {
    if (timerPausedRemaining != null) {
      setRemaining(timerPausedRemaining);
      return;
    }
    if (timerEndsAt == null) {
      setRemaining(0);
      return;
    }

    let rafId: number;
    const tick = () => {
      const left = Math.max(0, (timerEndsAt - Date.now()) / 1000);
      setRemaining(left);
      if (left > 0) {
        rafId = requestAnimationFrame(tick);
      }
    };
    tick();

    return () => cancelAnimationFrame(rafId);
  }, [timerEndsAt, timerPausedRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  return {
    remaining,
    formatted: formatTime(remaining),
    isRunning,
    isPaused,
    isExpired,
    isWarning: isRunning && remaining > 0 && remaining <= 30,
  };
}
