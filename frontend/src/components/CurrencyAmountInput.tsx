'use client';

import React from 'react';
import {
  getCurrencyInputPaddingClass,
  getCurrencySymbolPrefix,
  parseCurrencyNumericInput,
} from '@/hooks/useCreateProjectForm';

export interface CurrencyAmountInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'className'
> {
  /** Token ticker (`USDC`, `EURC`, `XLM`, `PYUSD`) whose symbol prefix is rendered inside the left edge. */
  token?: string | null;
  /** Controlled numeric value or empty string when cleared. */
  value: number | '';
  /** Clean numeric change callback (parses values without currency symbol contamination). */
  onValueChange?: (value: number | '') => void;
  /** Standard React change handler, forwarded when consumers read `e.target.value` / `e.target.name`. */
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Extra classes merged onto the outer relative wrapper. */
  wrapperClassName?: string;
  /** Override/extend styling for the `<input>` element (left padding & right-align are preserved). */
  inputClassName?: string;
  /** Override/extend styling for the left currency prefix badge. */
  badgeClassName?: string;
  /** Optional `data-testid` for the `<input>` element. */
  'data-testid'?: string;
  /** Optional `data-testid` for the prefix badge element. */
  badgeTestId?: string;
}

const DEFAULT_INPUT_CLASS =
  'w-full py-2.5 pr-3.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-sm placeholder-[#71717a] focus:outline-none focus:border-blue-500 transition-colors';

/**
 * Right-aligned numeric amount input with a fixed inside-left currency prefix badge (`$` / `€` / `XLM`)
 * and automatic left-padding + symbol sanitization on change and paste.
 */
export function CurrencyAmountInput({
  token,
  value,
  onValueChange,
  onChange,
  wrapperClassName = '',
  inputClassName = DEFAULT_INPUT_CLASS,
  badgeClassName = '',
  badgeTestId = 'currency-prefix-badge',
  onPaste,
  ...rest
}: CurrencyAmountInputProps) {
  const prefix = getCurrencySymbolPrefix(token);
  const paddingClass = getCurrencyInputPaddingClass(prefix);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseCurrencyNumericInput(event.target.value);
    if (onValueChange) {
      onValueChange(parsed);
    }
    if (onChange) {
      onChange(event);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (onPaste) {
      onPaste(event);
      if (event.defaultPrevented) return;
    }
    const rawText = event.clipboardData?.getData('text');
    if (!rawText) return;

    // Sanitize pasted text such as "$1,250.50" or "XLM 300" before the native number input drops it.
    if (/[$€₱✦,\s]|[a-zA-Z]/.test(rawText)) {
      const parsed = parseCurrencyNumericInput(rawText);
      if (parsed !== '') {
        event.preventDefault();
        if (onValueChange) {
          onValueChange(parsed);
        }
        if (onChange) {
          const syntheticEvent = {
            ...event,
            target: { ...event.currentTarget, name: rest.name || '', value: String(parsed) },
            currentTarget: { ...event.currentTarget, name: rest.name || '', value: String(parsed) },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      }
    }
  };

  return (
    <div className={`relative flex items-center ${wrapperClassName}`.trim()}>
      <span
        data-testid={badgeTestId}
        aria-hidden="true"
        className={`pointer-events-none select-none absolute left-2.5 inset-y-0 flex items-center ${badgeClassName}`.trim()}
      >
        <span className="inline-flex items-center justify-center rounded-md border border-[#3f3f46]/80 bg-[#18181b]/90 px-1.5 py-0.5 text-[11px] font-bold leading-none tracking-tight text-[#d4d4d8]">
          {prefix}
        </span>
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={handleInputChange}
        onPaste={handlePaste}
        className={`${inputClassName} ${paddingClass} text-right tabular-nums`.trim()}
        {...rest}
      />
    </div>
  );
}

export default CurrencyAmountInput;
