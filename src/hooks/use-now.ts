import { useEffect, useState } from 'react';

/**
 * Current time that advances on an interval, so relative labels such as "In 1h" stay
 * correct on a screen left open. Reading the clock during render would be impure; this
 * keeps it in state.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
