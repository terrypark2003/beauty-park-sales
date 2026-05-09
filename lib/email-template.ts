import { SalesReport, computeTotals, formatKRW } from "./types";

export function buildEmailHTML(r: SalesReport): string {
  const t = computeTotals(r);
  const row = (label: string, val: string, bold = false) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;${bold ? "font-weight:700;" : ""}">${label}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;${bold ? "font-weight:700;" : ""}">${val}</td></tr>`;

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const terminalRows = r.terminals
    .map(
      (term) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${term.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatKRW(term.card)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatKRW(term.cash)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatKRW(term.card + term.cash)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="ko"><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;color:#111827;">
  <div style="max-width:680px;margin:24px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
    <div style="padding:20px 24px;background:#db2777;color:#fff;">
      <div style="font-size:14px;opacity:.9;">뷰티파크의원</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px;">일일 매출 보고서</div>
    </div>
    <div style="padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("작성일자", r.reportDate)}
        ${row("작성자", r.author)}
        ${row("검토자", r.reviewer || "-")}
      </table>

      <h3 style="margin:24px 0 8px;font-size:15px;">1. CRM 매출</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;">
        ${row("비보험(과세) 카드", formatKRW(r.crmTaxableCard))}
        ${row("비보험(과세) 현금영수증", formatKRW(r.crmTaxableCashReceipt))}
        ${row("비보험(과세) 통장입금", formatKRW(r.crmTaxableTransfer))}
        ${row("비보험(면세) 카드", formatKRW(r.crmTaxFreeCard))}
        ${row("CRM 총 매출", formatKRW(t.crmGrandTotal), true)}
      </table>

      <h3 style="margin:24px 0 8px;font-size:15px;">2. 단말기 매출</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">단말기</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">카드</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">현금/이체</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">합계</th>
          </tr>
        </thead>
        <tbody>${terminalRows}
          <tr style="background:#fdf2f8;font-weight:700;">
            <td style="padding:8px 12px;">합계</td>
            <td style="padding:8px 12px;text-align:right;">${formatKRW(t.terminalCardTotal)}</td>
            <td style="padding:8px 12px;text-align:right;">${formatKRW(t.terminalCashTotal)}</td>
            <td style="padding:8px 12px;text-align:right;">${formatKRW(t.terminalGrandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin:24px 0 8px;font-size:15px;">3. 일치 확인</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">구분</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">CRM</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">단말기</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">차액</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">카드</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.crmCardTotal)}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.terminalCardTotal)}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.cardDiff)}</td></tr>
          <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">현금/이체</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.crmCashTotal)}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.terminalCashTotal)}</td><td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatKRW(t.cashDiff)}</td></tr>
          <tr style="font-weight:700;"><td style="padding:8px 12px;">총 매출</td><td style="padding:8px 12px;text-align:right;">${formatKRW(t.crmGrandTotal)}</td><td style="padding:8px 12px;text-align:right;">${formatKRW(t.terminalGrandTotal)}</td><td style="padding:8px 12px;text-align:right;">${formatKRW(t.totalDiff)}</td></tr>
        </tbody>
      </table>

      <h3 style="margin:24px 0 8px;font-size:15px;">4. 시재 · 이체 내역 · 비고</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${row("현금 시재", formatKRW(r.cashOnHand))}
        <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;width:120px;">이체 내역</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(r.transferDetails || "-")}</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top;">비고</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap;">${escapeHtml(r.notes || "-")}</td></tr>
      </table>

      <div style="margin-top:24px;font-size:12px;color:#6b7280;">제출 시각: ${new Date(r.submittedAt).toLocaleString("ko-KR")}</div>
    </div>
  </div>
</body></html>`;
}
