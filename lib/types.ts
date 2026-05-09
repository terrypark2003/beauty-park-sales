export interface SalesReport {
  id: string;
  reportDate: string;
  author: string;
  reviewer?: string;
  // CRM
  crmTaxableCard: number;
  crmTaxableCashReceipt: number;
  crmTaxableTransfer: number;
  crmTaxFreeCard: number;
  // Terminals
  terminals: Array<{
    name: string;
    card: number;
    cash: number;
  }>;
  // Etc
  cashOnHand: number;
  transferDetails?: string;
  notes?: string;
  // Meta
  submittedAt: string;
  // Admin confirmation tracking
  crmConfirmed?: boolean;
  terminalConfirmed?: boolean;
  salesConfirmed?: boolean;
  confirmedAt?: string;
  lastEditedAt?: string;
}

export interface ReportTotals {
  crmCardTotal: number;
  crmCashTotal: number;
  crmGrandTotal: number;
  terminalCardTotal: number;
  terminalCashTotal: number;
  terminalGrandTotal: number;
  cardDiff: number;
  cashDiff: number;
  totalDiff: number;
  isMatched: boolean;
}

export function computeTotals(r: {
  crmTaxableCard: number;
  crmTaxableCashReceipt: number;
  crmTaxableTransfer: number;
  crmTaxFreeCard: number;
  terminals: Array<{ card: number; cash: number }>;
}): ReportTotals {
  const crmCardTotal = (r.crmTaxableCard || 0) + (r.crmTaxFreeCard || 0);
  const crmCashTotal =
    (r.crmTaxableCashReceipt || 0) + (r.crmTaxableTransfer || 0);
  const crmGrandTotal = crmCardTotal + crmCashTotal;

  const terminalCardTotal = r.terminals.reduce(
    (s, t) => s + (Number(t.card) || 0),
    0
  );
  const terminalCashTotal = r.terminals.reduce(
    (s, t) => s + (Number(t.cash) || 0),
    0
  );
  const terminalGrandTotal = terminalCardTotal + terminalCashTotal;

  const cardDiff = terminalCardTotal - crmCardTotal;
  const cashDiff = terminalCashTotal - crmCashTotal;
  const totalDiff = terminalGrandTotal - crmGrandTotal;

  return {
    crmCardTotal,
    crmCashTotal,
    crmGrandTotal,
    terminalCardTotal,
    terminalCashTotal,
    terminalGrandTotal,
    cardDiff,
    cashDiff,
    totalDiff,
    isMatched: cardDiff === 0 && cashDiff === 0 && totalDiff === 0,
  };
}

export function formatKRW(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n || 0));
}

export function isFullyConfirmed(r: Pick<SalesReport, "crmConfirmed" | "terminalConfirmed" | "salesConfirmed">): boolean {
  return Boolean(r.crmConfirmed && r.terminalConfirmed && r.salesConfirmed);
}
