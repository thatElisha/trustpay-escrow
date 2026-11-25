import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useCurrencyStore,
  SUPPORTED_FIAT_CURRENCIES,
  DEFAULT_USD_FX_RATES,
  DEFAULT_CRYPTO_USD_RATES,
} from './currencyStore';

describe('currencyStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useCurrencyStore.setState({
      selectedCurrency: 'USD',
      rates: { ...DEFAULT_USD_FX_RATES },
      cryptoRates: { ...DEFAULT_CRYPTO_USD_RATES },
      lastUpdated: null,
      rateTrend: 'neutral',
      isLive: false,
    });
  });

  it('initializes with default USD currency and rates', () => {
    const state = useCurrencyStore.getState();
    expect(state.selectedCurrency).toBe('USD');
    expect(state.rates.USD).toBe(1.0);
    expect(state.rates.EUR).toBe(0.92);
    expect(state.rates.GBP).toBe(0.79);
    expect(state.rates.NGN).toBe(1490.0);
  });

  it('persists selected currency into localStorage', () => {
    const { setCurrency } = useCurrencyStore.getState();
    setCurrency('EUR');

    expect(useCurrencyStore.getState().selectedCurrency).toBe('EUR');
    expect(localStorage.getItem('trustpay_preferred_currency')).toBe('EUR');

    setCurrency('JPY');
    expect(useCurrencyStore.getState().selectedCurrency).toBe('JPY');
    expect(localStorage.getItem('trustpay_preferred_currency')).toBe('JPY');
  });

  it('converts USDC to various fiat currencies accurately', () => {
    const { convertCryptoToFiat } = useCurrencyStore.getState();

    // 100 USDC in USD (1.0 rate)
    const usd = convertCryptoToFiat(100, 'USDC', 'USD');
    expect(usd.fiatAmount).toBe(100);
    expect(usd.formatted).toBe('$100.00');
    expect(usd.symbol).toBe('$');

    // 100 USDC in EUR (0.92 rate)
    const eur = convertCryptoToFiat(100, 'USDC', 'EUR');
    expect(eur.fiatAmount).toBeCloseTo(92.0, 2);
    expect(eur.formatted).toBe('€92.00');

    // 100 USDC in NGN (1490.0 rate)
    const ngn = convertCryptoToFiat(100, 'USDC', 'NGN');
    expect(ngn.fiatAmount).toBe(149000);
    expect(ngn.formatted).toBe('₦149,000.00');

    // 100 USDC in JPY (154.5 rate, 0 decimals)
    const jpy = convertCryptoToFiat(100, 'USDC', 'JPY');
    expect(jpy.fiatAmount).toBeCloseTo(15450, 0);
    expect(jpy.formatted).toBe('¥15,450');
  });

  it('converts XLM with token price multiplier and decimals properly', () => {
    const { convertCryptoToFiat } = useCurrencyStore.getState();

    // 1000 XLM at $0.24 = $240 USD
    const usd = convertCryptoToFiat(1000, 'XLM', 'USD');
    expect(usd.fiatAmount).toBe(240);
    expect(usd.formatted).toBe('$240.00');

    // 1000 XLM in EUR at $0.24 * 0.92 = €220.80
    const eur = convertCryptoToFiat(1000, 'XLM', 'EUR');
    expect(eur.fiatAmount).toBeCloseTo(220.8, 2);
    expect(eur.formatted).toBe('€220.80');
  });

  it('calculates portfolio total across multiple tokens and escrows', () => {
    const { calculatePortfolioTotal } = useCurrencyStore.getState();

    const escrows = [
      { amount: 500, token: 'USDC' }, // $500
      { amount: 1000, token: 'XLM' },  // $240
      { amount: 100, token: 'EURC' },  // $108
    ];
    // Total USD = 500 + 240 + 108 = $848

    const totalUsd = calculatePortfolioTotal(escrows, 'USD');
    expect(totalUsd.totalFiat).toBeCloseTo(848, 2);
    expect(totalUsd.formatted).toBe('$848.00');
    expect(totalUsd.currency).toBe('USD');

    // In GBP (0.79 rate) => 848 * 0.79 = £669.92
    const totalGbp = calculatePortfolioTotal(escrows, 'GBP');
    expect(totalGbp.totalFiat).toBeCloseTo(669.92, 2);
    expect(totalGbp.formatted).toBe('£669.92');
    expect(totalGbp.currency).toBe('GBP');
  });

  it('tracks rate trends (up/down) when rates update dynamically', () => {
    const store = useCurrencyStore.getState();

    // Update USD/EUR rate upwards
    store.setCurrency('EUR');
    store.updateRates({ EUR: 0.95 });

    expect(useCurrencyStore.getState().rateTrend).toBe('up');
    expect(useCurrencyStore.getState().rates.EUR).toBe(0.95);
    expect(useCurrencyStore.getState().isLive).toBe(true);

    // Update rate downwards
    useCurrencyStore.getState().updateRates({ EUR: 0.90 });
    expect(useCurrencyStore.getState().rateTrend).toBe('down');
    expect(useCurrencyStore.getState().rates.EUR).toBe(0.90);
  });

  it('handles fallback gracefully when token is unknown or network fails', () => {
    const { convertCryptoToFiat } = useCurrencyStore.getState();

    // Unknown token defaults to 1.0 multiplier
    const converted = convertCryptoToFiat(50, 'UNKNOWN_TOKEN', 'USD');
    expect(converted.fiatAmount).toBe(50);
    expect(converted.formatted).toBe('$50.00');
  });
});
