'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  useCurrencyStore,
  SUPPORTED_FIAT_CURRENCIES,
  FiatCurrency,
} from '@/store/currencyStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';

export interface CurrencyConverterWidgetProps {
  variant?: 'compact' | 'full' | 'dropdown-only';
  portfolioItems?: Array<{ amount: number | string; token: string }>;
  className?: string;
}

export function CurrencyConverterWidget({
  variant = 'compact',
  portfolioItems = [],
  className = '',
}: CurrencyConverterWidgetProps) {
  const {
    selectedCurrency,
    rates,
    cryptoRates,
    rateTrend,
    isLive,
    setCurrency,
    updateRates,
    convertCryptoToFiat,
    calculatePortfolioTotal,
  } = useCurrencyStore();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [flashColor, setFlashColor] = useState<'green' | 'red' | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setIsOpen(false), isOpen);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Flash animation trigger on rateTrend change
  useEffect(() => {
    if (rateTrend === 'up') {
      setFlashColor('green');
      const timer = setTimeout(() => setFlashColor(null), 1200);
      return () => clearTimeout(timer);
    } else if (rateTrend === 'down') {
      setFlashColor('red');
      const timer = setTimeout(() => setFlashColor(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [rateTrend, rates]);

  // Simulated live feed / heartbeat polling
  useEffect(() => {
    const interval = setInterval(() => {
      // Micro-fluctuation simulation (±0.05%) to demonstrate real-time visual change flash
      const delta = (Math.random() - 0.49) * 0.002;
      const currentRate = rates[selectedCurrency] || 1.0;
      const updatedRate = Number((currentRate * (1 + delta)).toFixed(4));

      updateRates({
        [selectedCurrency]: updatedRate,
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedCurrency, rates, updateRates]);

  const currentMeta = SUPPORTED_FIAT_CURRENCIES[selectedCurrency] || SUPPORTED_FIAT_CURRENCIES.USD;
  const portfolio = calculatePortfolioTotal(portfolioItems);

  const filteredCurrencies = Object.values(SUPPORTED_FIAT_CURRENCIES).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-flex items-center text-xs ${className}`}
      data-testid="currency-converter-widget"
    >
      {/* Portfolio Value Badge (if items provided) */}
      {portfolioItems.length > 0 && variant !== 'dropdown-only' && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 mr-2 rounded-md border text-xs font-medium transition-colors duration-300 ${
            flashColor === 'green'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : flashColor === 'red'
              ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-300'
          }`}
          data-testid="portfolio-value-badge"
          title={`Estimated portfolio value across all escrows in ${selectedCurrency}`}
        >
          <span className="text-neutral-500 font-normal">≈</span>
          <span className="font-semibold text-neutral-100">{portfolio.formatted}</span>
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider">{selectedCurrency}</span>
        </div>
      )}

      {/* Currency Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-neutral-700/80 bg-neutral-900/80 hover:bg-neutral-800/80 text-neutral-200 transition-all focus:outline-none focus:ring-1 focus:ring-sky-500 ${
          flashColor === 'green'
            ? 'ring-1 ring-emerald-500/60'
            : flashColor === 'red'
            ? 'ring-1 ring-rose-500/60'
            : ''
        }`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select display fiat currency"
        data-testid="currency-selector-button"
      >
        <span className="text-sm leading-none">{currentMeta.flag}</span>
        <span className="font-semibold">{currentMeta.code}</span>
        <span className="text-neutral-400 text-[10px]">({currentMeta.symbol})</span>

        {/* Live indicator pip */}
        <span
          className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
            isLive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
          }`}
          title={isLive ? 'Live FX rates active' : 'Offline baseline rates'}
        />

        <svg
          className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-neutral-800 bg-neutral-950/95 backdrop-blur-md shadow-2xl z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          role="listbox"
          data-testid="currency-dropdown"
        >
          {/* Search Input */}
          <div className="relative mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 15+ currencies..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-800 bg-neutral-900/90 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500"
              autoFocus
              data-testid="currency-search-input"
            />
          </div>

          {/* Currency List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
            {filteredCurrencies.map((c) => {
              const isSelected = c.code === selectedCurrency;
              const rate = rates[c.code] || 1.0;

              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    setCurrency(c.code);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-400 font-semibold'
                      : 'hover:bg-neutral-800/60 text-neutral-300'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                  data-testid={`currency-option-${c.code}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm">{c.flag}</span>
                    <div className="flex flex-col text-left">
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] text-neutral-500">{c.code} · {c.symbol}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono ml-2">
                    {rate > 100 ? Math.round(rate) : rate.toFixed(2)}
                  </span>
                </button>
              );
            })}

            {filteredCurrencies.length === 0 && (
              <div className="py-4 text-center text-xs text-neutral-500">
                No matching currencies found
              </div>
            )}
          </div>

          {/* Quick Rates Ticker Footer */}
          <div className="mt-2 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400 px-1">
            <span>1 XLM ≈ {convertCryptoToFiat(1, 'XLM').formatted}</span>
            <span>1 USDC ≈ {convertCryptoToFiat(1, 'USDC').formatted}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact Inline Badge that automatically renders the converted fiat equivalent of any crypto token balance.
 */
export function ConvertedFiatBadge({
  amount,
  token,
  showApprox = true,
  className = '',
}: {
  amount: number | string;
  token: string;
  showApprox?: boolean;
  className?: string;
}) {
  const { convertCryptoToFiat } = useCurrencyStore();
  const converted = convertCryptoToFiat(amount, token);

  return (
    <span
      className={`inline-flex items-center text-neutral-400 font-normal ${className}`}
      data-testid="converted-fiat-badge"
    >
      {showApprox && <span className="mr-0.5">≈</span>}
      {converted.formatted}
    </span>
  );
}
