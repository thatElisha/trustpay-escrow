import type { Project } from '@/types';

/** Fallback USD rates when a historical quote is unavailable (#161). */
const FALLBACK_USD_RATES: Record<string, number> = {
  USDC: 1,
  PYUSD: 1,
  EURC: 1.08,
  XLM: 0.12,
};

/** CoinGecko ids for tokens whose price moves and needs a dated lookup. */
const COINGECKO_IDS: Record<string, string> = {
  XLM: 'stellar',
  EURC: 'euro-coin',
};

export interface TaxRow {
  date: string;
  projectId: string;
  projectTitle: string;
  clientAddress: string;
  milestoneTitle: string;
  token: string;
  tokenAmount: number;
  /** USD price of one token on the receipt date. */
  usdRate: number;
  /** Fair market value at receipt, the gross income to report. */
  fiatValue: number;
  /** Basis of the received crypto, equal to its fair market value at receipt. */
  costBasis: number;
  txHash: string;
  explorerUrl: string;
}

export interface TaxSummary {
  year: number;
  rowCount: number;
  grossIncomeUsd: number;
  totalCostBasisUsd: number;
  byToken: Record<string, { amount: number; usd: number }>;
}

export function csvEscape(value: string | number | null | undefined): string {
  const s = String(value ?? '');
  // Neutralise spreadsheet formula injection from user-supplied text.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  return [headers, ...rows].map((line) => line.map(csvEscape).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function fallbackUsdRate(token?: string): number {
  return FALLBACK_USD_RATES[(token || 'USDC').toUpperCase()] ?? 1;
}

const rateCache = new Map<string, number>();

/**
 * USD price of a token on a given day (YYYY-MM-DD). Stablecoins are pegged;
 * volatile tokens are looked up on CoinGecko with a fallback rate on failure.
 */
export async function fetchHistoricalUsdRate(token: string, isoDate: string): Promise<number> {
  const symbol = token.toUpperCase();
  const id = COINGECKO_IDS[symbol];
  if (!id || !isoDate) return fallbackUsdRate(symbol);

  const cacheKey = `${symbol}:${isoDate}`;
  const cached = rateCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const [y, m, d] = isoDate.split('-');
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${id}/history?date=${d}-${m}-${y}&localization=false`
    );
    if (!res.ok) throw new Error(`rate lookup failed (${res.status})`);
    const data = await res.json();
    const price = Number(data?.market_data?.current_price?.usd);
    if (Number.isFinite(price) && price > 0) {
      rateCache.set(cacheKey, price);
      return price;
    }
  } catch {
    // Fall through to the static rate so the export still completes.
  }
  return fallbackUsdRate(symbol);
}

function toIsoDay(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function sameAddress(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

type MilestoneWithTx = NonNullable<Project['milestones']>[number] & { tx_hash?: string };

/**
 * Collects milestone payouts the freelancer received in the tax year.
 * Only approved milestones count as income; rates are filled in afterwards.
 */
export function collectTaxableMilestones(
  projects: Project[],
  freelancerAddress: string,
  year: number
): Array<Omit<TaxRow, 'usdRate' | 'fiatValue' | 'costBasis'>> {
  const out: Array<Omit<TaxRow, 'usdRate' | 'fiatValue' | 'costBasis'>> = [];

  for (const project of projects) {
    if (!sameAddress(project.freelancer_address, freelancerAddress)) continue;

    for (const m of (project.milestones || []) as MilestoneWithTx[]) {
      if (m.status !== 'approved') continue;
      const amount = Number(m.amount) || 0;
      if (amount <= 0) continue;

      const date = toIsoDay(m.submitted_at || m.due_date || project.created_at);
      if (!date || Number(date.slice(0, 4)) !== year) continue;

      const txHash = m.tx_hash || project.tx_hash || '';
      out.push({
        date,
        projectId: project.id,
        projectTitle: project.title,
        clientAddress: project.client_address || '',
        milestoneTitle: m.title || `Milestone ${m.milestone_index + 1}`,
        token: (project.token || 'USDC').toUpperCase(),
        tokenAmount: amount,
        txHash,
        explorerUrl: txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : '',
      });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Prices each payout at its receipt date and builds the final tax rows. */
export async function buildTaxRows(
  projects: Project[],
  freelancerAddress: string,
  year: number,
  rateLookup: (token: string, date: string) => Promise<number> = fetchHistoricalUsdRate
): Promise<TaxRow[]> {
  const base = collectTaxableMilestones(projects, freelancerAddress, year);

  const keys = Array.from(new Set(base.map((r) => `${r.token}|${r.date}`)));
  const rates = new Map<string, number>();
  await Promise.all(
    keys.map(async (key) => {
      const [token, date] = key.split('|');
      rates.set(key, await rateLookup(token, date));
    })
  );

  return base.map((r) => {
    const usdRate = rates.get(`${r.token}|${r.date}`) ?? fallbackUsdRate(r.token);
    const fiatValue = Number((r.tokenAmount * usdRate).toFixed(2));
    return { ...r, usdRate, fiatValue, costBasis: fiatValue };
  });
}

export function summarizeTaxRows(rows: TaxRow[], year: number): TaxSummary {
  const byToken: TaxSummary['byToken'] = {};
  let gross = 0;
  let basis = 0;
  for (const r of rows) {
    gross += r.fiatValue;
    basis += r.costBasis;
    const entry = (byToken[r.token] ||= { amount: 0, usd: 0 });
    entry.amount += r.tokenAmount;
    entry.usd += r.fiatValue;
  }
  return {
    year,
    rowCount: rows.length,
    grossIncomeUsd: Number(gross.toFixed(2)),
    totalCostBasisUsd: Number(basis.toFixed(2)),
    byToken,
  };
}

export const TAX_CSV_HEADERS = [
  'Date Received',
  'Project',
  'Milestone',
  'Client Address',
  'Asset',
  'Amount',
  'USD Rate At Receipt',
  'Fair Market Value (USD)',
  'Cost Basis (USD)',
  'Transaction Hash',
  'Explorer Link',
];

export function taxRowsToCsv(rows: TaxRow[], summary?: TaxSummary): string {
  const body = rows.map((r) => [
    r.date,
    r.projectTitle,
    r.milestoneTitle,
    r.clientAddress,
    r.token,
    r.tokenAmount,
    r.usdRate,
    r.fiatValue,
    r.costBasis,
    r.txHash,
    r.explorerUrl,
  ]);
  if (summary) {
    body.push([]);
    body.push(['TOTAL', '', '', '', '', '', '', summary.grossIncomeUsd, summary.totalCostBasisUsd, '', '']);
  }
  return toCsv(TAX_CSV_HEADERS, body);
}

export function exportTaxCsv(rows: TaxRow[], summary: TaxSummary): void {
  downloadCsv(`trustpay-tax-summary-${summary.year}.csv`, taxRowsToCsv(rows, summary));
}

function escapeHtml(v: string | number): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function taxReportHtml(rows: TaxRow[], summary: TaxSummary, freelancerAddress: string): string {
  const tokenLines = Object.entries(summary.byToken)
    .map(
      ([token, v]) =>
        `<tr><td>${escapeHtml(token)}</td><td>${v.amount.toFixed(4)}</td><td>$${v.usd.toFixed(2)}</td></tr>`
    )
    .join('');
  const lines = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.projectTitle)}<br/><small>${escapeHtml(
          r.milestoneTitle
        )}</small></td><td>${escapeHtml(r.tokenAmount)} ${escapeHtml(r.token)}</td><td>$${r.usdRate.toFixed(
          4
        )}</td><td>$${r.fiatValue.toFixed(2)}</td><td>$${r.costBasis.toFixed(2)}</td><td class="hash">${escapeHtml(
          r.txHash || 'n/a'
        )}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Crypto Income Summary ${summary.year}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f0f0f0}.hash{font-family:monospace;font-size:10px;word-break:break-all}.total{font-size:14px;font-weight:bold}small{color:#555}</style></head><body>
<h1>Cryptocurrency Income Summary &mdash; Tax Year ${summary.year}</h1>
<div>Freelancer wallet: ${escapeHtml(freelancerAddress)}</div>
<p class="total">Gross income (fair market value at receipt): $${summary.grossIncomeUsd.toFixed(2)} USD<br/>Total cost basis: $${summary.totalCostBasisUsd.toFixed(2)} USD</p>
<table><tr><th>Asset</th><th>Total received</th><th>USD value</th></tr>${tokenLines}</table>
<table><tr><th>Date</th><th>Project / Milestone</th><th>Amount</th><th>USD rate</th><th>FMV (USD)</th><th>Cost basis</th><th>Tx hash</th></tr>${lines}</table>
<small>Estimates for record keeping only. Confirm figures with a tax professional before filing.</small>
</body></html>`;
}

/** Opens a printable report so the browser can save it as PDF. */
export function exportTaxPdf(rows: TaxRow[], summary: TaxSummary, freelancerAddress: string): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(taxReportHtml(rows, summary, freelancerAddress));
  win.document.close();
  win.focus();
  win.print();
  return true;
}
