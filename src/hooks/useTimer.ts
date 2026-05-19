import { useState, useEffect, useCallback } from 'react';

export function useTimer(timerEndsAt?: number, timerPausedRemaining?: number) {
  const [now, setNow] = useState<number>(() => new Date().getTime());

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setNow(Date.now());
      rafId = requestAnimationFrame(tick);
    };
    
    if (timerEndsAt != null && timerPausedRemaining == null) {
      rafId = requestAnimationFrame(tick);
    }
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [timerEndsAt, timerPausedRemaining]);

  const isPaused = timerPausedRemaining != null;
  const isRunning = timerEndsAt != null && !isPaused;
  
  let remaining = 0;
  if (timerPausedRemaining != null) {
    remaining = timerPausedRemaining;
  } else if (timerEndsAt != null) {
    remaining = Math.max(0, (timerEndsAt - now) / 1000);
  }

  const isExpired = isRunning && remaining <= 0 && timerEndsAt != null && timerEndsAt <= now;

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
