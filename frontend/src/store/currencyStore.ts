import { create } from 'zustand';

export type FiatCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'NGN'
  | 'CAD'
  | 'AUD'
  | 'CHF'
  | 'INR'
  | 'BRL'
  | 'ZAR'
  | 'SGD'
  | 'HKD'
  | 'CNY'
  | 'AED';

export interface CurrencyMetadata {
  code: FiatCurrency;
  symbol: string;
  name: string;
  flag: string;
  decimals: number;
}

export const SUPPORTED_FIAT_CURRENCIES: Record<FiatCurrency, CurrencyMetadata> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', decimals: 0 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', decimals: 2 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', decimals: 2 },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷', decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦', decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', decimals: 2 },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', decimals: 2 },
};

// Base exchange rates relative to 1 USD
export const DEFAULT_USD_FX_RATES: Record<FiatCurrency, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.5,
  NGN: 1490.0,
  CAD: 1.38,
  AUD: 1.52,
  CHF: 0.88,
  INR: 84.4,
  BRL: 5.75,
  ZAR: 18.2,
  SGD: 1.34,
  HKD: 7.78,
  CNY: 7.24,
  AED: 3.67,
};

// Crypto token multipliers in USD
export const DEFAULT_CRYPTO_USD_RATES: Record<string, number> = {
  USDC: 1.0,
  EURC: 1.08,
  PYUSD: 1.0,
  XLM: 0.24,
};

const STORAGE_KEY = 'trustpay_preferred_currency';

function getInitialCurrency(): FiatCurrency {
  if (typeof window === 'undefined') return 'USD';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in SUPPORTED_FIAT_CURRENCIES) {
      return saved as FiatCurrency;
    }
  } catch {
    // LocalStorage blocked or unavailable
  }
  return 'USD';
}

export interface ConvertedValue {
  fiatAmount: number;
  formatted: string;
  symbol: string;
  rate: number;
}

export interface PortfolioValuation {
  totalFiat: number;
  formatted: string;
  currency: FiatCurrency;
  symbol: string;
}

export interface CurrencyState {
  selectedCurrency: FiatCurrency;
  rates: Record<FiatCurrency, number>;
  cryptoRates: Record<string, number>;
  lastUpdated: string | null;
  rateTrend: 'up' | 'down' | 'neutral';
  isLive: boolean;
  setCurrency: (currency: FiatCurrency) => void;
  updateRates: (newRates: Partial<Record<FiatCurrency, number>>) => void;
  updateCryptoRates: (newCryptoRates: Partial<Record<string, number>>) => void;
  convertCryptoToFiat: (
    cryptoAmount: number | string,
    tokenSymbol: string,
    targetCurrency?: FiatCurrency
  ) => ConvertedValue;
  calculatePortfolioTotal: (
    items: Array<{ amount: number | string; token: string }>,
    targetCurrency?: FiatCurrency
  ) => PortfolioValuation;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  selectedCurrency: getInitialCurrency(),
  rates: { ...DEFAULT_USD_FX_RATES },
  cryptoRates: { ...DEFAULT_CRYPTO_USD_RATES },
  lastUpdated: null,
  rateTrend: 'neutral',
  isLive: false,

  setCurrency: (currency: FiatCurrency) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, currency);
      } catch {
        // Fallback gracefully
      }
    }
    set({ selectedCurrency: currency });
  },

  updateRates: (newRates) => {
    const current = get().rates;
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    const selected = get().selectedCurrency;

    if (newRates[selected] !== undefined && current[selected] !== undefined) {
      if (newRates[selected]! > current[selected]) trend = 'up';
      else if (newRates[selected]! < current[selected]) trend = 'down';
    }

    set({
      rates: { ...current, ...newRates },
      lastUpdated: new Date().toISOString(),
      rateTrend: trend,
      isLive: true,
    });
  },

  updateCryptoRates: (newCryptoRates) => {
    const merged: Record<string, number> = { ...get().cryptoRates };
    for (const [k, v] of Object.entries(newCryptoRates)) {
      if (typeof v === 'number') {
        merged[k] = v;
      }
    }
    set({
      cryptoRates: merged,
      lastUpdated: new Date().toISOString(),
      isLive: true,
    });
  },

  convertCryptoToFiat: (cryptoAmount, tokenSymbol, targetCurrency) => {
    const state = get();
    const fiat = targetCurrency || state.selectedCurrency;
    const meta = SUPPORTED_FIAT_CURRENCIES[fiat] || SUPPORTED_FIAT_CURRENCIES.USD;

    const parsedAmount = typeof cryptoAmount === 'string' ? parseFloat(cryptoAmount) || 0 : cryptoAmount;
    const normalizedToken = (tokenSymbol || 'USDC').toUpperCase();

    // 1. Convert token to USD equivalent
    const tokenUsdPrice = state.cryptoRates[normalizedToken] ?? 1.0;
    const usdValue = parsedAmount * tokenUsdPrice;

    // 2. Convert USD to Target Fiat
    const fxRate = state.rates[fiat] ?? DEFAULT_USD_FX_RATES[fiat] ?? 1.0;
    const fiatAmount = usdValue * fxRate;

    // 3. Format with locale and currency decimals
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(fiatAmount);

    return {
      fiatAmount,
      formatted: `${meta.symbol}${formatted}`,
      symbol: meta.symbol,
      rate: fxRate,
    };
  },

  calculatePortfolioTotal: (items, targetCurrency) => {
    const state = get();
    const fiat = targetCurrency || state.selectedCurrency;
    const meta = SUPPORTED_FIAT_CURRENCIES[fiat] || SUPPORTED_FIAT_CURRENCIES.USD;

    let totalUsd = 0;
    for (const item of items) {
      const amount = typeof item.amount === 'string' ? parseFloat(item.amount) || 0 : item.amount;
      const token = (item.token || 'USDC').toUpperCase();
      const tokenPrice = state.cryptoRates[token] ?? 1.0;
      totalUsd += amount * tokenPrice;
    }

    const fxRate = state.rates[fiat] ?? DEFAULT_USD_FX_RATES[fiat] ?? 1.0;
    const totalFiat = totalUsd * fxRate;

    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
    }).format(totalFiat);

    return {
      totalFiat,
      formatted: `${meta.symbol}${formatted}`,
      currency: fiat,
      symbol: meta.symbol,
    };
  },
}));
