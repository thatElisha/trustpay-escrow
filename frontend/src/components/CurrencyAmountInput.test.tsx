import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CurrencyAmountInput } from './CurrencyAmountInput';
import {
  getCurrencyInputPaddingClass,
  getCurrencySymbolPrefix,
  parseCurrencyNumericInput,
} from '@/hooks/useCreateProjectForm';

describe('Currency prefix helpers (#193)', () => {
  it('maps supported tokens to $ / € / XLM prefixes', () => {
    expect(getCurrencySymbolPrefix('USDC')).toBe('$');
    expect(getCurrencySymbolPrefix('PYUSD')).toBe('$');
    expect(getCurrencySymbolPrefix('EURC')).toBe('€');
    expect(getCurrencySymbolPrefix('XLM')).toBe('XLM');
    expect(getCurrencySymbolPrefix('xlm')).toBe('XLM');
    expect(getCurrencySymbolPrefix('')).toBe('$');
    expect(getCurrencySymbolPrefix(null)).toBe('$');
  });

  it('scales left padding dynamically based on prefix width', () => {
    expect(getCurrencyInputPaddingClass('$')).toBe('pl-11');
    expect(getCurrencyInputPaddingClass('€')).toBe('pl-11');
    expect(getCurrencyInputPaddingClass('XLM')).toBe('pl-16');
  });

  it('parses numeric values cleanly without currency symbol contamination', () => {
    expect(parseCurrencyNumericInput('1500')).toBe(1500);
    expect(parseCurrencyNumericInput('$1,250.50')).toBe(1250.5);
    expect(parseCurrencyNumericInput('€ 840.25')).toBe(840.25);
    expect(parseCurrencyNumericInput('XLM 320')).toBe(320);
    expect(parseCurrencyNumericInput('')).toBe('');
    expect(parseCurrencyNumericInput('   ')).toBe('');
    expect(parseCurrencyNumericInput('$')).toBe('');
  });
});

describe('CurrencyAmountInput (#193)', () => {
  it('renders a fixed left-edge currency badge and right-aligned padded numeric input', () => {
    const onValueChange = vi.fn();
    render(
      <CurrencyAmountInput
        token="USDC"
        value={900}
        onValueChange={onValueChange}
        data-testid="amount-input"
      />
    );

    const badge = screen.getByTestId('currency-prefix-badge');
    const input = screen.getByTestId('amount-input');

    expect(badge).toHaveTextContent('$');
    expect(badge).toHaveClass('absolute', 'left-2.5', 'pointer-events-none');
    expect(input).toHaveClass('text-right', 'tabular-nums', 'pl-11');
    expect(input).toHaveValue(900);
  });

  it('dynamically updates prefix symbol and padding when switching active project token', () => {
    function TokenSwitchHarness() {
      const [token, setToken] = useState<'USDC' | 'EURC' | 'XLM'>('USDC');
      const [amount, setAmount] = useState<number | ''>(500);
      return (
        <div>
          <button type="button" onClick={() => setToken('EURC')}>
            EURC
          </button>
          <button type="button" onClick={() => setToken('XLM')}>
            XLM
          </button>
          <CurrencyAmountInput
            token={token}
            value={amount}
            onValueChange={setAmount}
            data-testid="dynamic-amount"
          />
        </div>
      );
    }

    render(<TokenSwitchHarness />);
    const badge = screen.getByTestId('currency-prefix-badge');
    const input = screen.getByTestId('dynamic-amount');

    expect(badge).toHaveTextContent('$');
    expect(input).toHaveClass('pl-11');

    fireEvent.click(screen.getByRole('button', { name: 'EURC' }));
    expect(badge).toHaveTextContent('€');
    expect(input).toHaveClass('pl-11');

    fireEvent.click(screen.getByRole('button', { name: 'XLM' }));
    expect(badge).toHaveTextContent('XLM');
    expect(input).toHaveClass('pl-16');
  });

  it('sanitizes pasted currency-formatted strings without symbol contamination', () => {
    const onValueChange = vi.fn();
    render(
      <CurrencyAmountInput
        token="EURC"
        value=""
        onValueChange={onValueChange}
        data-testid="paste-amount"
      />
    );

    const input = screen.getByTestId('paste-amount');
    fireEvent.paste(input, {
      clipboardData: { getData: () => '€ 1,450.75' },
    });
    expect(onValueChange).toHaveBeenCalledWith(1450.75);

    fireEvent.change(input, { target: { value: '250.5' } });
    expect(onValueChange).toHaveBeenCalledWith(250.5);
  });
});
