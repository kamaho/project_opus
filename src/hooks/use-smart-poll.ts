"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SmartPollOptions {
  /** Base interval in ms */
  interval: number;
  /** Max interval after exponential backoff on errors */
  backoffMax?: number;
  /** Stop polling when browser tab is hidden */
  pauseWhenHidden?: boolean;
  /** Skip fetch if last one was more recent than this (ms) */
  dedupWindow?: number;
  /** Start fetching immediately on mount (default true) */
  immediate?: boolean;
}

const DEFAULT_OPTS: Required<Omit<SmartPollOptions, "interval">> = {
  backoffMax: 300_000,
  pauseWhenHidden: true,
  dedupWindow: 5_000,
  immediate: true,
};

export function useSmartPoll<T>(
  fetcher: () => Promise<T>,
  opts: SmartPollOptions
) {
  const config = { ...DEFAULT_OPTS, ...opts };
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef<number>(0);
  const currentIntervalRef = useRef(config.interval);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < config.dedupWindow) return;

    if (!mountedRef.current) return;
    setLoading(true);

    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      lastFetchRef.current = Date.now();
      currentIntervalRef.current = config.interval;
    } catch {
      currentIntervalRef.current = Math.min(
        currentIntervalRef.current * 2,
        config.backoffMax
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [config.dedupWindow, config.interval, config.backoffMax]);

  useEffect(() => {
    mountedRef.current = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let active = true;

    const tick = async () => {
      if (!active) return;

      if (config.pauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") {
        timeoutId = setTimeout(tick, 5_000);
        return;
      }

      await doFetch();
      if (active) {
        timeoutId = setTimeout(tick, currentIntervalRef.current);
      }
    };

    if (config.immediate) {
      tick();
    } else {
      timeoutId = setTimeout(tick, config.interval);
    }

    return () => {
      active = false;
      mountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [doFetch, config.pauseWhenHidden, config.immediate, config.interval]);

  return { data, loading, refetch: () => doFetch(true) };
}
