import type {
  BlendPoolAsset,
  BlendPoolRate,
  BlendYieldPoint,
  BlendYieldSummary,
} from '@/types';

/** Share of escrowed principal routed into Blend (the rest stays liquid). */
export const BLEND_ALLOCATION_RATIO = 0.7;
/** Yield split between client and platform. */
export const CLIENT_YIELD_SHARE = 0.8;
export const PLATFORM_YIELD_SHARE = 1 - CLIENT_YIELD_SHARE;
export const BLEND_ASSETS: BlendPoolAsset[] = ['USDC', 'XLM'];

export const FALLBACK_BLEND_RATES: Record<BlendPoolAsset, { apy: number; utilization: number }> = {
  USDC: { apy: 0.048, utilization: 0.82 },
  XLM: { apy: 0.032, utilization: 0.61 },
};

export function fallbackRates(now = new Date()): BlendPoolRate[] {
  return BLEND_ASSETS.map((asset) => ({
    asset,
    ...FALLBACK_BLEND_RATES[asset],
    updatedAt: now.toISOString(),
    source: 'fallback' as const,
  }));
}

function toFraction(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  // Oracles often report percentages (4.8) rather than fractions (0.048).
  return n > 1 ? n / 100 : n;
}

/** Normalizes an oracle response into rates, tolerating a few common shapes. */
export function parseBlendRates(payload: unknown, now = new Date()): BlendPoolRate[] {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { pools?: unknown[] })?.pools)
      ? (payload as { pools: unknown[] }).pools
      : [];

  const rates: BlendPoolRate[] = [];
  for (const entry of raw as Array<Record<string, unknown>>) {
    const asset = String(entry?.asset ?? entry?.symbol ?? '').toUpperCase() as BlendPoolAsset;
    if (!BLEND_ASSETS.includes(asset)) continue;
    const apy = toFraction(entry.apy ?? entry.supply_apy ?? entry.supplyApy);
    if (apy === null) continue;
    rates.push({
      asset,
      apy,
      utilization: Math.min(1, toFraction(entry.utilization ?? entry.utilization_rate) ?? 0),
      updatedAt: now.toISOString(),
      source: 'live',
    });
  }
  return rates;
}

/** Balance after daily compounding: P * (1 + apy/365)^days. Days may be fractional. */
export function compoundBalance(principal: number, apy: number, days: number): number {
  if (principal <= 0 || days <= 0) return Math.max(0, principal);
  return principal * Math.pow(1 + apy / 365, days);
}

export function summarizeYield(principal: number, apy: number, days: number): BlendYieldSummary {
  const balance = compoundBalance(principal, apy, days);
  const accrued = balance - Math.max(0, principal);
  return {
    principal,
    days,
    accrued,
    balance,
    clientShare: accrued * CLIENT_YIELD_SHARE,
    platformShare: accrued * PLATFORM_YIELD_SHARE,
  };
}

/** Evenly spaced points for charting the compounding curve. */
export function buildYieldSeries(principal: number, apy: number, days: number, steps = 24): BlendYieldPoint[] {
  const points: BlendYieldPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const day = (days * i) / steps;
    const balance = compoundBalance(principal, apy, day);
    points.push({ day, balance, accrued: balance - principal });
  }
  return points;
}

/** Whole and fractional days elapsed since `lockedAt`, or 0 when unknown. */
export function elapsedDays(lockedAt: string | undefined, now = Date.now()): number {
  if (!lockedAt) return 0;
  const t = new Date(lockedAt).getTime();
  if (Number.isNaN(t) || t > now) return 0;
  return (now - t) / 86_400_000;
}
