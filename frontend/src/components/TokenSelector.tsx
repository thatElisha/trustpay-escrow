'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  SUPPORTED_TOKENS,
  getTokenContractAddress,
  type TokenConfig,
} from '@/config/tokens';

type TokenSymbol = TokenConfig['symbol'];

/** Brand-coloured SVG marks for each supported asset. */
export function TokenLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 32 32', 'aria-hidden': true } as const;
  switch (symbol) {
    case 'USDC':
      return (
        <svg {...common} data-testid="token-logo-USDC">
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <path
            d="M20.4 18.3c0-2.1-1.3-2.8-3.8-3.1-1.8-.3-2.2-.7-2.2-1.5s.6-1.3 1.8-1.3c1.1 0 1.7.4 2 1.3.1.2.2.3.4.3h1c.3 0 .5-.2.4-.5-.3-1.4-1.3-2.4-2.8-2.6v-1.6c0-.3-.2-.5-.5-.5h-.9c-.3 0-.5.2-.5.5v1.5c-1.9.3-3.1 1.5-3.1 3.1 0 2 1.2 2.7 3.8 3 1.7.3 2.3.7 2.3 1.6s-.8 1.5-1.9 1.5c-1.5 0-2-.6-2.2-1.4-.1-.2-.2-.3-.4-.3h-1.1c-.3 0-.5.2-.4.5.3 1.6 1.3 2.5 3.2 2.8v1.6c0 .3.2.5.5.5h.9c.3 0 .5-.2.5-.5v-1.6c1.9-.3 3.1-1.6 3.1-3.3z"
            fill="#fff"
          />
        </svg>
      );
    case 'EURC':
      return (
        <svg {...common} data-testid="token-logo-EURC">
          <circle cx="16" cy="16" r="16" fill="#1D4ED8" />
          <path
            d="M20.5 20.2a5.2 5.2 0 1 1 0-8.4M9.5 14.2h8M9.5 17.8h8"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case 'XLM':
      return (
        <svg {...common} data-testid="token-logo-XLM">
          <circle cx="16" cy="16" r="16" fill="#0F172A" />
          <path
            d="M23.6 9.4l-2.1 1.1-9.7 4.9a5.9 5.9 0 0 1-.1-1c0-1.4.5-2.7 1.4-3.7l1.2-1.2c.5-.5 1.2-.9 2-1.1l-1.7-.9a7.2 7.2 0 0 0-4.5 2.2 7.1 7.1 0 0 0-1.4 8.1l-1.4.7v1.9l2.7-1.4 12.1-6.1 1.9-1v-1.9l-.5.4zM24.4 12.2L12.3 18.4l-2.7 1.4v1.9l2.1-1.1 9.7-4.9c.1.3.1.7.1 1 0 1.4-.5 2.7-1.4 3.7l-1.2 1.2c-.5.5-1.2.9-2 1.1l1.7.9a7.2 7.2 0 0 0 4.5-2.2 7.1 7.1 0 0 0 1.4-8.1l1.4-.7v-1.9z"
            fill="#fff"
          />
        </svg>
      );
    case 'PYUSD':
      return (
        <svg {...common} data-testid="token-logo-PYUSD">
          <circle cx="16" cy="16" r="16" fill="#0070BA" />
          <path
            d="M12 24V9h5.4c2.6 0 4.2 1.4 4.2 3.8 0 2.5-1.7 4-4.4 4h-2.6V24H12zm2.6-9.6h2.4c1.2 0 1.9-.6 1.9-1.7 0-1.1-.7-1.6-1.9-1.6h-2.4v3.3z"
            fill="#fff"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="16" fill="#52525B" />
          <text x="16" y="21" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
            {symbol.slice(0, 1)}
          </text>
        </svg>
      );
  }
}

export function formatTokenBalance(balance: number | null | undefined, decimals = 7): string {
  if (balance === null || balance === undefined) return '—';
  return balance.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(decimals, 4),
  });
}

function shortenContract(address: string) {
  return address.length > 16 ? `${address.slice(0, 6)}...${address.slice(-6)}` : address;
}

function CopyContractButton({ address, symbol }: { address: string; symbol: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success(`${symbol} contract address copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the contract address');
    }
  };

  return (
    <button
      type="button"
      data-testid={`copy-contract-${symbol}`}
      aria-label={`Copy ${symbol} contract address`}
      title={copied ? 'Copied!' : 'Copy contract address'}
      onClick={handleCopy}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') void handleCopy(event);
      }}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#a1a1aa] transition-colors hover:bg-[#2d2d33] hover:text-white"
    >
      {copied ? (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-emerald-400" aria-hidden="true">
          <path d="M7.7 13.6L4.4 10.3l-1.4 1.4 4.7 4.7 9.3-9.3-1.4-1.4z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M6 2a2 2 0 0 0-2 2v9h2V4h7V2H6zm3 4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H9zm0 2h6v8H9V8z" />
        </svg>
      )}
    </button>
  );
}

function ContractLine({ token, network }: { token: TokenConfig; network: string }) {
  const address = getTokenContractAddress(token, network);
  const networkLabel = network === 'PUBLIC' ? 'Mainnet' : 'Testnet';

  if (!address) {
    return (
      <span className="text-[10px] text-amber-400/90">
        No {networkLabel} contract configured
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] text-[#71717a]">
      <span
        className="inline-flex items-center gap-1 font-mono"
        title={`Verified ${networkLabel} Soroban contract: ${address}`}
      >
        <svg viewBox="0 0 20 20" className="h-3 w-3 fill-emerald-400" aria-label="Verified" role="img">
          <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-1.2 13L5 10.2l1.300-1.300 2.500 2.500 4.600-4.600 1.300 1.300L8.800 14z" />
        </svg>
        {shortenContract(address)}
      </span>
      <CopyContractButton address={address} symbol={token.symbol} />
    </span>
  );
}

export interface TokenSelectorProps {
  value: TokenSymbol;
  onChange: (symbol: TokenSymbol) => void;
  /** Available balance per token symbol for the connected wallet (null = unknown). */
  balances?: Record<string, number | null>;
  balancesLoading?: boolean;
  /** Stellar network used to pick the contract address shown. Defaults to TESTNET. */
  network?: string | null;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function TokenSelector({
  value,
  onChange,
  balances = {},
  balancesLoading = false,
  network = 'TESTNET',
  disabled = false,
  label,
  className = '',
}: TokenSelectorProps) {
  const tokens = Object.values(SUPPORTED_TOKENS);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listId = useId();
  const labelId = useId();
  const resolvedNetwork = network || 'TESTNET';
  const selected = SUPPORTED_TOKENS[value] || tokens[0];

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback(
    (symbol: TokenSymbol) => {
      onChange(symbol);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openMenu = () => {
    setActiveIndex(Math.max(0, tokens.findIndex((t) => t.symbol === value)));
    setOpen(true);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % tokens.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + tokens.length) % tokens.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(tokens[activeIndex].symbol);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const renderBalance = (symbol: string) => {
    const balance = balances[symbol];
    return (
      <span
        data-testid={`token-balance-${symbol}`}
        className="shrink-0 rounded-full border border-[#333338] bg-[#232326] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#e4e4e7]"
        title={`Available ${symbol} balance`}
      >
        {balancesLoading && balance === undefined ? '...' : formatTokenBalance(balance)}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <span id={labelId} className="mb-1.5 block text-xs font-semibold text-[#e4e4e7] sm:text-sm">
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : 'Escrow token'}
        data-testid="token-selector-trigger"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
        className="flex w-full items-center gap-3 rounded-xl border border-[#333338] bg-[#232326] px-3 py-2.5 text-left transition-colors hover:border-[#52525b] focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TokenLogo symbol={selected.symbol} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">
            {selected.symbol}{' '}
            <span className="text-xs font-normal text-[#a1a1aa]">{selected.name}</span>
          </span>
          <span className="block text-[10px] text-[#71717a]">{selected.decimals} decimals</span>
        </span>
        {renderBalance(selected.symbol)}
        <svg className="h-4 w-4 shrink-0 fill-current text-[#a1a1aa]" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
        </svg>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Supported escrow tokens"
          data-testid="token-selector-list"
          className="animate-menu-fade-in absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[#333338] bg-[#18181c] p-1 shadow-2xl shadow-black/50"
        >
          {tokens.map((token, index) => {
            const isSelected = token.symbol === value;
            return (
              <li
                key={token.symbol}
                role="option"
                aria-selected={isSelected}
                data-testid={`token-option-${token.symbol}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(token.symbol)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                  index === activeIndex ? 'bg-[#27272a]' : ''
                } ${isSelected ? 'ring-1 ring-blue-500/60' : ''}`}
              >
                <TokenLogo symbol={token.symbol} size={32} />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block text-sm font-bold text-white">
                    {token.symbol}{' '}
                    <span className="text-xs font-normal text-[#a1a1aa]">
                      {token.name} · {token.decimals} dec
                    </span>
                  </span>
                  <ContractLine token={token} network={resolvedNetwork} />
                </span>
                {renderBalance(token.symbol)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default TokenSelector;
