'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import type { Project } from '@/types';
import {
  buildTaxRows,
  summarizeTaxRows,
  exportTaxCsv,
  exportTaxPdf,
  type TaxRow,
} from '@/lib/csv-export';

export interface TaxExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  freelancerAddress: string | null;
  /** Optional pre-loaded projects; fetched from the API when omitted. */
  projects?: Project[];
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function TaxExportModal({ isOpen, onClose, freelancerAddress, projects }: TaxExportModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [source, setSource] = useState<Project[]>(projects || []);
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEscapeKey(onClose, isOpen);

  // Load the freelancer's projects when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    if (projects) {
      setSource(projects);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await authFetch(`${apiUrl}/api/projects?page=1&limit=100`);
        if (!res.ok) throw new Error('Failed to load projects');
        const data = await res.json();
        if (!cancelled) setSource(Array.isArray(data.projects) ? data.projects : []);
      } catch {
        if (!cancelled) toast.error('Could not load payments for the tax report.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projects]);

  // Re-price payouts whenever the year or data changes.
  useEffect(() => {
    if (!isOpen || !freelancerAddress) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    buildTaxRows(source, freelancerAddress, year)
      .then((built) => {
        if (!cancelled) setRows(built);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, source, freelancerAddress, year]);

  const summary = useMemo(() => summarizeTaxRows(rows, year), [rows, year]);

  if (!isOpen) return null;

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const handleCsv = () => {
    if (rows.length === 0) {
      toast.error(`No received payments found for ${year}.`);
      return;
    }
    exportTaxCsv(rows, summary);
    toast.success(`Exported ${rows.length} payments for tax year ${year}.`);
  };

  const handlePdf = () => {
    if (rows.length === 0 || !freelancerAddress) {
      toast.error(`No received payments found for ${year}.`);
      return;
    }
    if (!exportTaxPdf(rows, summary, freelancerAddress)) {
      toast.error('Allow pop-ups to generate the PDF report.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tax export"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-3xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Tax Export</span>
          <h3 className="text-xl font-bold text-white mt-1">Crypto Income Summary for Annual Filing</h3>
          <p className="text-xs text-slate-400 mt-1">
            Approved milestone payments received on Stellar, valued in USD at the date of receipt, with
            cost basis and on-chain transaction hashes.
          </p>
        </div>

        <div className="text-xs">
          <label htmlFor="tax-year" className="block text-slate-300 font-semibold mb-1.5">
            Tax year
          </label>
          <select
            id="tax-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full sm:w-48 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Payments</div>
            <div className="text-lg font-bold text-white mt-1">{loading ? '…' : summary.rowCount}</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Gross income (FMV)</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              {loading ? '…' : usd(summary.grossIncomeUsd)}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
            <div className="text-slate-400">Cost basis</div>
            <div className="text-lg font-bold text-white mt-1">
              {loading ? '…' : usd(summary.totalCostBasisUsd)}
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">FMV (USD)</th>
                  <th className="px-3 py-2">Tx</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rows.map((r, i) => (
                  <tr key={`${r.projectId}-${r.milestoneTitle}-${i}`} className="border-t border-slate-800">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2">{r.projectTitle}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.tokenAmount} {r.token}
                    </td>
                    <td className="px-3 py-2">{usd(r.fiatValue)}</td>
                    <td className="px-3 py-2 font-mono">
                      {r.txHash ? `${r.txHash.slice(0, 8)}…` : 'n/a'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4">
            No approved payments were received in {year}.
          </p>
        )}

        <p className="text-[11px] text-slate-500">
          Figures are estimates for record keeping. Confirm with a tax professional before filing.
        </p>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="outline" onClick={handlePdf} disabled={loading}>
            Export PDF
          </Button>
          <Button onClick={handleCsv} disabled={loading}>
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TaxExportModal;
