import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { getStellarExplorerUrl } from '@/lib/soroban';

export interface SettlementReceiptData {
  projectTitle: string;
  milestoneTitle: string;
  milestoneIndex?: number;
  amount: number;
  token: string;
  clientAddress?: string;
  freelancerAddress?: string;
  txHash?: string;
  ledger?: number | string;
  closedAt?: string;
  usdAmount?: number;
  vatRate?: number;
  businessName?: string;
  notes?: string;
  invoiceNumber?: string;
  issuedAt?: string;
  explorerUrl?: string;
}

export interface ReceiptTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

export function calculateReceiptTotals(data: SettlementReceiptData): ReceiptTotals {
  const subtotal = Number.isFinite(data.amount) ? Math.max(0, data.amount) : 0;
  const rate = Number.isFinite(data.vatRate) ? Math.max(0, data.vatRate || 0) : 0;
  const taxAmount = Number((subtotal * (rate / 100)).toFixed(7));
  return { subtotal, taxAmount, total: Number((subtotal + taxAmount).toFixed(7)) };
}

export function slugifyReceiptPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}

export function getReceiptFilename(data: SettlementReceiptData): string {
  const project = slugifyReceiptPart(data.projectTitle);
  const milestone = slugifyReceiptPart(data.milestoneTitle);
  return `trustpay-receipt-${project}-${milestone}.pdf`;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

function writeWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, lineHeight = 5): number {
  const lines = doc.splitTextToSize(text || '—', width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export async function generateReceiptPdf(data: SettlementReceiptData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = calculateReceiptTotals(data);
  const issuedAt = data.issuedAt || new Date().toISOString();
  const invoiceNumber = data.invoiceNumber || `TP-${Date.now().toString(36).toUpperCase()}`;
  const verificationUrl =
    data.explorerUrl || (data.txHash ? getStellarExplorerUrl(data.txHash, 'tx') : 'https://stellar.expert/explorer/testnet');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('SETTLEMENT RECEIPT', 16, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('TrustPay Escrow  |  Stellar Soroban milestone payment proof', 16, 31);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.text(`Invoice: ${invoiceNumber}`, 16, 53);
  doc.text(`Issued: ${new Date(issuedAt).toLocaleString()}`, 194, 53, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(16, 58, 194, 58);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PARTIES', 16, 68);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENT PUBLIC KEY', 16, 75);
  doc.text('FREELANCER PUBLIC KEY', 108, 75);
  doc.setTextColor(30, 41, 59);
  writeWrapped(doc, data.clientAddress || '—', 16, 81, 84);
  writeWrapped(doc, data.freelancerAddress || '—', 108, 81, 86);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MILESTONE DETAILS', 16, 104);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Project: ${data.projectTitle || '—'}`, 16, 112);
  doc.text(
    `Milestone: ${data.milestoneIndex ? `#${data.milestoneIndex} - ` : ''}${data.milestoneTitle || '—'}`,
    16,
    119
  );
  doc.text(`Settlement date: ${data.closedAt ? new Date(data.closedAt).toLocaleString() : '—'}`, 16, 126);
  doc.text(`Business legal name: ${data.businessName || 'TrustPay Escrow'}`, 16, 133);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(16, 142, 178, 46, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PAYMENT SUMMARY', 22, 151);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Milestone amount (${data.token || 'USDC'})`, 22, 160);
  doc.text(formatAmount(totals.subtotal), 188, 160, { align: 'right' });
  doc.text(`VAT / Tax (${data.vatRate || 0}%)`, 22, 168);
  doc.text(formatAmount(totals.taxAmount), 188, 168, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Total settled (${data.token || 'USDC'})`, 22, 177);
  doc.text(formatAmount(totals.total), 188, 177, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(79, 70, 229);
  doc.text(
    `USD valuation at settlement: ${data.usdAmount !== undefined ? `$${formatAmount(data.usdAmount)}` : 'Not available'}`,
    22,
    184
  );

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ON-CHAIN VERIFICATION', 16, 202);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const shortHash = data.txHash
    ? data.txHash.length > 38
      ? `${data.txHash.slice(0, 26)}...${data.txHash.slice(-12)}`
      : data.txHash
    : 'Not recorded';
  writeWrapped(doc, `Transaction hash: ${shortHash}`, 16, 210, 132, 4.5);
  doc.text(`Ledger: ${data.ledger ?? '—'}`, 16, 222);
  doc.text(`Closed: ${data.closedAt ? new Date(data.closedAt).toLocaleString() : '—'}`, 16, 229);

  const qr = QRCode.create(verificationUrl, { errorCorrectionLevel: 'M' });
  const qrSize = qr.modules.size;
  const cell = 34 / (qrSize + 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(158, 207, 34, 34, 'F');
  doc.setFillColor(15, 23, 42);
  for (let row = 0; row < qrSize; row++) {
    for (let column = 0; column < qrSize; column++) {
      if (qr.modules.data[row * qrSize + column]) {
        doc.rect(158 + (column + 1) * cell, 207 + (row + 1) * cell, cell, cell, 'F');
      }
    }
  }
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to verify on Stellar Expert', 175, 246, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTES', 16, 258);
  doc.setFont('helvetica', 'normal');
  writeWrapped(doc, data.notes || 'Payment settled through TrustPay Escrow smart contract.', 16, 264, 178, 4.5);

  doc.setDrawColor(226, 232, 240);
  doc.line(16, 282, 194, 282);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('This document is a client-side generated settlement receipt. Verify the QR code against the Stellar ledger.', 16, 287);

  return doc.output('blob');
}

export async function downloadReceiptPdf(data: SettlementReceiptData): Promise<void> {
  const blob = await generateReceiptPdf(data);
  if (typeof document === 'undefined') return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getReceiptFilename(data);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
