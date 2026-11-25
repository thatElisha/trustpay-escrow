'use client';

import React, { useEffect, useState } from 'react';
import type { BlendPoolAsset } from '@/types';
import { useBlendYield } from '@/hooks/useBlendYield';
import {
  BLEND_ASSETS,
  CLIENT_YIELD_SHARE,
  PLATFORM_YIELD_SHARE,
  elapsedDays,
  summarizeYield,
} from '@/lib/blend-yield';

export interface BlendYieldVisualizerProps {
  /** Escrowed principal currently deposited into Blend. */
  principal: number;
  /** Token of the escrow; picks the matching pool (USDC for other stablecoins). */
  token?: string;
  /** When the principal was deposited; drives the live accrued interest. */
  lockedAt?: string;
  /** Initial projection length in days. */
  defaultDays?: number;
  className?: string;
}

const money = (n: number, digits = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function BlendYieldVisualizer({
  principal,
  token = 'USDC',
  lockedAt,
  defaultDays = 90,
  className = '',
}: BlendYieldVisualizerProps) {
  const [asset, setAsset] = useState<BlendPoolAsset>(token.toUpperCase() === 'XLM' ? 'XLM' : 'USDC');
  const [days, setDays] = useState(defaultDays);
  const [now, setNow] = useState(() => Date.now());

  const { rate, projection, series, loading } = useBlendYield({ asset, principal, days });

  // Tick so accrued interest visibly grows while a deposit is live.
  useEffect(() => {
    if (!lockedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedAt]);

  const elapsed = elapsedDays(lockedAt, now);
  const accruedToDate = summarizeYield(principal, rate.apy, elapsed);

  // Chart geometry
  const width = 560;
  const height = 160;
  const pad = { top: 12, right: 12, bottom: 20, left: 12 };
  const maxAccrued = Math.max(series[series.length - 1]?.accrued ?? 0, 0.01);
  const x = (day: number) => pad.left + (day / days) * (width - pad.left - pad.right);
  const y = (accrued: number) =>
    pad.top + (1 - accrued / maxAccrued) * (height - pad.top - pad.bottom);
  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.day).toFixed(1)} ${y(p.accrued).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(days).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const elapsedX = elapsed > 0 && elapsed <= days ? x(elapsed) : null;

  return (
    <section
      data-testid="blend-yield-visualizer"
      className={`rounded-2xl border border-[#27272a] bg-[#18181b] p-5 sm:p-6 space-y-5 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">Blend Yield Tracker</h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                rate.source === 'live'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {loading && rate.source !== 'live' ? 'Syncing…' : rate.source === 'live' ? 'Live' : 'Estimated'}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            Interest accrued on escrowed principal in the Blend lending pool.
          </p>
        </div>

        <div role="tablist" aria-label="Blend pool" className="flex items-center gap-1 bg-[#121214] p-1 rounded-xl border border-[#27272a]">
          {BLEND_ASSETS.map((a) => (
            <button
              key={a}
              role="tab"
              aria-selected={asset === a}
              onClick={() => setAsset(a)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                asset === a ? 'bg-blue-600 text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">{asset} pool APY</div>
          <div className="text-lg font-black text-emerald-400 mt-1">{(rate.apy * 100).toFixed(2)}%</div>
        </div>
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">Utilization</div>
          <div className="text-lg font-black text-white mt-1">{(rate.utilization * 100).toFixed(1)}%</div>
          <div className="h-1 mt-1.5 rounded-full bg-[#27272a] overflow-hidden">
            <div
              className="h-full bg-blue-500"
              style={{ width: `${Math.min(100, rate.utilization * 100)}%` }}
            />
          </div>
        </div>
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">In Blend</div>
          <div className="text-lg font-black text-white mt-1">{money(principal)}</div>
        </div>
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">{lockedAt ? `Accrued (${elapsed.toFixed(1)}d)` : 'Accrued to date'}</div>
          <div className="text-lg font-black text-blue-400 mt-1" data-testid="accrued-to-date">
            {lockedAt ? money(accruedToDate.accrued, 4) : '—'}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <label htmlFor="blend-projection-days" className="font-semibold text-[#e4e4e7]">
            Projection: {days} day{days === 1 ? '' : 's'}
          </label>
          <span className="text-[#a1a1aa]">Daily compounding</span>
        </div>
        <input
          id="blend-projection-days"
          type="range"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full accent-blue-500"
        />

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 mt-2"
          role="img"
          aria-label={`Projected interest grows to ${money(projection.accrued)} ${asset} over ${days} days`}
        >
          <path d={area} fill="rgba(59,130,246,0.15)" />
          <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
          {elapsedX !== null && (
            <line x1={elapsedX} x2={elapsedX} y1={pad.top} y2={height - pad.bottom} stroke="#22c55e" strokeDasharray="4 3" />
          )}
          <text x={pad.left} y={height - 4} fontSize="10" fill="#71717a">Day 0</text>
          <text x={width - pad.right} y={height - 4} fontSize="10" fill="#71717a" textAnchor="end">
            Day {days}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">Projected interest</div>
          <div className="text-base font-bold text-white mt-1" data-testid="projected-interest">
            {money(projection.accrued)} {asset}
          </div>
        </div>
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">Client share ({Math.round(CLIENT_YIELD_SHARE * 100)}%)</div>
          <div className="text-base font-bold text-emerald-400 mt-1">{money(projection.clientShare)}</div>
        </div>
        <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3">
          <div className="text-[#a1a1aa]">Platform share ({Math.round(PLATFORM_YIELD_SHARE * 100)}%)</div>
          <div className="text-base font-bold text-[#a1a1aa] mt-1">{money(projection.platformShare)}</div>
        </div>
      </div>
    </section>
  );
}

export default BlendYieldVisualizer;
