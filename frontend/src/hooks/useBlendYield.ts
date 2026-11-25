import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BlendPoolAsset, BlendPoolRate } from '@/types';
import {
  buildYieldSeries,
  fallbackRates,
  parseBlendRates,
  summarizeYield,
} from '@/lib/blend-yield';

export interface UseBlendYieldOptions {
  asset: BlendPoolAsset;
  /** Principal deposited into the Blend pool. */
  principal: number;
  /** Days to project forward from the deposit. */
  days: number;
  pollIntervalMs?: number;
}

const oracleUrl = () =>
  process.env.NEXT_PUBLIC_BLEND_ORACLE_URL ||
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/blend/pools`;

/** Polls Blend pool rates and derives compound-interest projections (#118). */
export function useBlendYield({ asset, principal, days, pollIntervalMs = 60_000 }: UseBlendYieldOptions) {
  const [rates, setRates] = useState<BlendPoolRate[]>(() => fallbackRates());
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(oracleUrl());
      if (!res.ok) throw new Error(`Blend oracle responded ${res.status}`);
      const live = parseBlendRates(await res.json());
      if (live.length === 0) throw new Error('Blend oracle returned no pools');
      // Keep a fallback for any asset the oracle omitted.
      setRates(fallbackRates().map((f) => live.find((l) => l.asset === f.asset) ?? f));
    } catch {
      setRates((prev) => (prev.some((r) => r.source === 'live') ? prev : fallbackRates()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(refetch, pollIntervalMs);
    return () => clearInterval(timer);
  }, [refetch, pollIntervalMs]);

  const rate = useMemo(() => rates.find((r) => r.asset === asset) ?? fallbackRates()[0], [rates, asset]);
  const projection = useMemo(() => summarizeYield(principal, rate.apy, days), [principal, rate.apy, days]);
  const series = useMemo(() => buildYieldSeries(principal, rate.apy, days), [principal, rate.apy, days]);

  return { rates, rate, projection, series, loading, refetch };
}
