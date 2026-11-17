"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

export interface ApiState<T> { data: T | null; error: ApiError | null; loading: boolean; reload: () => void }

/** Fetch on mount and whenever `deps` change. Pass `null` to skip. Stale responses are ignored. */
export function useApi<T>(fetcher: (() => Promise<T>) | null, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(fetcher !== null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!fetcher) { setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    fetcher()
      .then((d) => { if (mine === seq.current) { setData(d); setError(null); } })
      .catch((e) => { if (mine === seq.current) setError(e instanceof ApiError ? e : new ApiError(String(e), 0)); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
