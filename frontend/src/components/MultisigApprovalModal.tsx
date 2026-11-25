'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useWalletStore, type PendingMultisigRequest } from '@/store/walletStore';
import {
  fetchMultisigAccountInfo,
  getRequiredThreshold,
  calculateCollectedWeight,
  getSignedKeysFromXdr,
  cosignTransactionXdr,
  submitCoSignedTransaction,
  getStellarExplorerUrl,
  type MultisigAccountInfo,
  type ThresholdCategory,
} from '@/lib/soroban';

function shortKey(key: string) {
  return key.length > 14 ? `${key.slice(0, 6)}...${key.slice(-6)}` : key;
}

export interface MultisigApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Multi-sig (treasury) account whose signers and thresholds are displayed. */
  accountAddress: string | null;
  /** The pending transaction being co-signed. When omitted only the signer overview is shown. */
  request?: PendingMultisigRequest | null;
  /** Threshold tier required by the operation. Soroban contract calls use `med`. */
  thresholdCategory?: ThresholdCategory;
  onSubmitted?: (txHash: string, request: PendingMultisigRequest) => void;
}

export function MultisigApprovalModal({
  isOpen,
  onClose,
  accountAddress,
  request = null,
  thresholdCategory = 'med',
  onSubmitted,
}: MultisigApprovalModalProps) {
  const { address, updatePendingMultisig, removePendingMultisig } = useWalletStore();
  const [info, setInfo] = useState<MultisigAccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'sign' | 'submit' | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEscapeKey(onClose, isOpen);

  const loadInfo = useCallback(async () => {
    if (!accountAddress) return;
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchMultisigAccountInfo(accountAddress));
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : 'Could not load account signers');
    } finally {
      setLoading(false);
    }
  }, [accountAddress]);

  useEffect(() => {
    if (!isOpen) return;
    setTxHash(null);
    void loadInfo();
  }, [isOpen, loadInfo]);

  const requiredWeight = info ? getRequiredThreshold(info.thresholds, thresholdCategory) : 0;
  const signedKeys = useMemo(
    () => (info && request ? getSignedKeysFromXdr(request.xdr, info.signers) : []),
    [info, request]
  );
  const collectedWeight = info ? calculateCollectedWeight(info.signers, signedKeys) : 0;
  const thresholdMet = Boolean(info) && requiredWeight > 0 && collectedWeight >= requiredWeight;
  const progress = requiredWeight > 0 ? Math.min(100, Math.round((collectedWeight / requiredWeight) * 100)) : 0;

  const mySigner = info?.signers.find((s) => s.key === address) || null;
  const iHaveSigned = Boolean(address && signedKeys.includes(address));
  const canSign = Boolean(request && mySigner && !iHaveSigned && !thresholdMet && !txHash);

  const handleSign = async () => {
    if (!request || !address) return;
    setBusy('sign');
    try {
      const signed = await cosignTransactionXdr(request.xdr, address);
      updatePendingMultisig(request.id, signed);
      toast.success('Your signature was added to the pending transaction.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign transaction');
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async () => {
    if (!request) return;
    setBusy('submit');
    try {
      const res = await submitCoSignedTransaction(request.xdr);
      setTxHash(res.txHash);
      removePendingMultisig(request.id);
      toast.success('Multi-sig transaction confirmed on Stellar!');
      onSubmitted?.(res.txHash, request);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit transaction');
    } finally {
      setBusy(null);
    }
  };

  const handleCopyXdr = async () => {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(request.xdr);
      toast.success('Transaction XDR copied. Share it with the next signer.');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="multisig-modal-title"
        data-testid="multisig-approval-modal"
        className="w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="multisig-modal-title" className="text-lg font-bold text-white">
              Multi-signature approval
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {request?.description || 'Signers and approval threshold for this account.'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading account signers...</p>}

        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}{' '}
            <button type="button" onClick={() => void loadInfo()} className="font-bold underline">
              Retry
            </button>
          </div>
        )}

        {info && (
          <>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-slate-300">Signature progress</span>
                <span data-testid="multisig-weight-label" className="font-mono font-bold text-white">
                  Weight {collectedWeight}/{requiredWeight} collected
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={requiredWeight}
                aria-valuenow={Math.min(collectedWeight, requiredWeight)}
                aria-label="Collected signer weight"
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    thresholdMet ? 'bg-emerald-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Thresholds — low {info.thresholds.low} · medium {info.thresholds.med} · high{' '}
                {info.thresholds.high}. Milestone release requires the{' '}
                <span className="font-semibold text-slate-300">{thresholdCategory}</span> threshold.
              </p>
            </div>

            <ul className="space-y-1.5" aria-label="Account signers">
              {info.signers.map((signer) => {
                const signed = signedKeys.includes(signer.key);
                const isMe = signer.key === address;
                return (
                  <li
                    key={signer.key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-white" title={signer.key}>
                        {shortKey(signer.key)}
                        {isMe && (
                          <span className="ml-2 rounded bg-blue-500/20 px-1.5 py-0.5 font-sans text-[10px] font-bold text-blue-300">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">Weight {signer.weight}</div>
                    </div>
                    {request && (
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          signed
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {signed ? '✓ Signed' : 'Pending'}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {request && !mySigner && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                The connected wallet is not a signer on this account. Switch to a signer wallet to add a signature.
              </p>
            )}
          </>
        )}

        {txHash && (
          <a
            href={getStellarExplorerUrl(txHash, 'tx')}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            ✓ Released on-chain — view transaction ↗
          </a>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
          {request && !txHash && (
            <button
              type="button"
              onClick={() => void handleCopyXdr()}
              className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Copy XDR
            </button>
          )}
          {canSign && (
            <button
              type="button"
              data-testid="multisig-sign-button"
              disabled={busy !== null}
              onClick={() => void handleSign()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'sign' ? 'Signing...' : `Sign with weight ${mySigner?.weight}`}
            </button>
          )}
          {request && thresholdMet && !txHash && (
            <button
              type="button"
              data-testid="multisig-submit-button"
              disabled={busy !== null}
              onClick={() => void handleSubmit()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'submit' ? 'Submitting...' : 'Submit transaction'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export interface PendingSignaturesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  requests: PendingMultisigRequest[];
  onSelect: (request: PendingMultisigRequest) => void;
}

/** Slide-over listing every transaction that is still waiting for co-signatures. */
export function PendingSignaturesDrawer({ isOpen, onClose, requests, onSelect }: PendingSignaturesDrawerProps) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Pending signatures"
        data-testid="pending-signatures-drawer"
        className="flex h-full w-full max-w-sm flex-col gap-4 border-l border-slate-700 bg-slate-900 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Pending signatures ({requests.length})</h3>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-slate-400">No transactions are waiting for co-signers.</p>
        ) : (
          <ul className="space-y-2 overflow-y-auto">
            {requests.map((req) => (
              <li key={req.id}>
                <button
                  type="button"
                  onClick={() => onSelect(req)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left transition-colors hover:border-blue-500/50"
                >
                  <div className="text-sm font-semibold text-white">{req.description}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    {shortKey(req.accountAddress)} · {new Date(req.createdAt).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export default MultisigApprovalModal;
