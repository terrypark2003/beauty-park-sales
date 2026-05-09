"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { computeTotals, formatKRW } from "@/lib/types";

const TERMINAL_COUNT = 5;

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

export default function ReportPage() {
  const router = useRouter();
  const [author, setAuthor] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reportDate, setReportDate] = useState(todayISO());

  const [crmTaxableCard, setCrmTaxableCard] = useState(0);
  const [crmTaxableCashReceipt, setCrmTaxableCashReceipt] = useState(0);
  const [crmTaxableTransfer, setCrmTaxableTransfer] = useState(0);
  const [crmTaxFreeCard, setCrmTaxFreeCard] = useState(0);

  const [terminals, setTerminals] = useState(
    Array.from({ length: TERMINAL_COUNT }, (_, i) => ({
      name: `단말기 ${i + 1}`,
      card: 0,
      cash: 0,
    }))
  );

  const [cashOnHand, setCashOnHand] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("bp_user_name") : null;
    if (!saved) {
      router.replace("/");
    } else {
      setAuthor(saved);
    }
  }, [router]);

  const totals = useMemo(
    () =>
      computeTotals({
        crmTaxableCard,
        crmTaxableCashReceipt,
        crmTaxableTransfer,
        crmTaxFreeCard,
        terminals,
      }),
    [crmTaxableCard, crmTaxableCashReceipt, crmTaxableTransfer, crmTaxFreeCard, terminals]
  );

  const updateTerminal = (i: number, key: "card" | "cash", value: number) => {
    setTerminals((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!totals.isMatched) {
      setMessage({
        type: "err",
        text: "CRM과 단말기 매출 합계가 일치하지 않아 제출할 수 없습니다. 차액을 0원으로 맞춰주세요.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportDate,
          author,
          reviewer,
          crmTaxableCard,
          crmTaxableCashReceipt,
          crmTaxableTransfer,
          crmTaxFreeCard,
          terminals,
          cashOnHand,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "제출 실패");
      setMessage({ type: "ok", text: "제출이 완료되었습니다. 이메일이 발송되었습니다." });
      // Reset numeric fields but keep author
      setCrmTaxableCard(0);
      setCrmTaxableCashReceipt(0);
      setCrmTaxableTransfer(0);
      setCrmTaxFreeCard(0);
      setTerminals(
        Array.from({ length: TERMINAL_COUNT }, (_, i) => ({
          name: `단말기 ${i + 1}`,
          card: 0,
          cash: 0,
        }))
      );
      setCashOnHand(0);
      setNotes("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "제출 실패";
      setMessage({ type: "err", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bp_user_name");
    router.push("/");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            뷰티파크의원 일일 매출 보고서
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            작성자: <span className="font-semibold text-neutral-700">{author}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-neutral-600 hover:text-neutral-900"
        >
          로그아웃
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date / Reviewer */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">작성일자</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">검토자 (선택)</label>
              <input
                type="text"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="검토자 이름"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </section>

        {/* 1. CRM 매출 */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">1. CRM 매출 입력</h2>
          <p className="text-sm text-neutral-500 mb-4">CRM 항목별 수납내역 4개 항목을 입력하세요</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-neutral-700">
                  <th className="text-left px-3 py-2 font-medium">종류</th>
                  <th className="text-left px-3 py-2 font-medium">내역</th>
                  <th className="text-right px-3 py-2 font-medium">금액 (원)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                <tr>
                  <td className="px-3 py-2" rowSpan={3}>비보험(과세)</td>
                  <td className="px-3 py-2">카드</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxableCard} onChange={setCrmTaxableCard} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2">현금영수증</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxableCashReceipt} onChange={setCrmTaxableCashReceipt} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2">통장입금</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxableTransfer} onChange={setCrmTaxableTransfer} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2">비보험(면세)</td>
                  <td className="px-3 py-2">카드</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxFreeCard} onChange={setCrmTaxFreeCard} /></td>
                </tr>
                <tr className="bg-brand-50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>CRM 총 매출</td>
                  <td className="px-3 py-2 text-right">{formatKRW(totals.crmGrandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. 단말기 매출 */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">2. 단말기 매출 입력</h2>
          <p className="text-sm text-neutral-500 mb-4">사용하는 단말기에만 입력하세요</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-neutral-700">
                  <th className="text-left px-3 py-2 font-medium">단말기</th>
                  <th className="text-right px-3 py-2 font-medium">카드</th>
                  <th className="text-right px-3 py-2 font-medium">현금/이체</th>
                  <th className="text-right px-3 py-2 font-medium">단말기 합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {terminals.map((t, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2"><MoneyInput value={t.card} onChange={(v) => updateTerminal(i, "card", v)} /></td>
                    <td className="px-3 py-2"><MoneyInput value={t.cash} onChange={(v) => updateTerminal(i, "cash", v)} /></td>
                    <td className="px-3 py-2 text-right text-neutral-700">{formatKRW(t.card + t.cash)}</td>
                  </tr>
                ))}
                <tr className="bg-brand-50 font-semibold">
                  <td className="px-3 py-2">합계</td>
                  <td className="px-3 py-2 text-right">{formatKRW(totals.terminalCardTotal)}</td>
                  <td className="px-3 py-2 text-right">{formatKRW(totals.terminalCashTotal)}</td>
                  <td className="px-3 py-2 text-right">{formatKRW(totals.terminalGrandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. 일치 여부 */}
        <section
          className={`rounded-xl border p-5 ${
            totals.isMatched
              ? "bg-emerald-50 border-emerald-200"
              : "bg-rose-50 border-rose-200"
          }`}
        >
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">3. CRM ↔ 단말기 일치 여부</h2>
          <p className="text-sm text-neutral-600 mb-4">차액이 모두 0원이어야 제출 가능합니다</p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/60 text-neutral-700">
                  <th className="text-left px-3 py-2 font-medium">구분</th>
                  <th className="text-right px-3 py-2 font-medium">CRM</th>
                  <th className="text-right px-3 py-2 font-medium">단말기</th>
                  <th className="text-right px-3 py-2 font-medium">차액</th>
                  <th className="text-center px-3 py-2 font-medium">일치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60">
                <DiffRow label="카드" crm={totals.crmCardTotal} terminal={totals.terminalCardTotal} diff={totals.cardDiff} />
                <DiffRow label="현금/이체" crm={totals.crmCashTotal} terminal={totals.terminalCashTotal} diff={totals.cashDiff} />
                <DiffRow label="총 매출" crm={totals.crmGrandTotal} terminal={totals.terminalGrandTotal} diff={totals.totalDiff} bold />
              </tbody>
            </table>
          </div>

          <div className={`mt-4 text-sm font-semibold ${totals.isMatched ? "text-emerald-700" : "text-rose-700"}`}>
            {totals.isMatched ? "✓ 모든 항목이 일치합니다. 제출 가능합니다." : "✗ 차액이 있습니다. 제출할 수 없습니다."}
          </div>
        </section>

        {/* 4. 시재 / 비고 */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">4. 시재 확인 및 비고</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">현금 시재</label>
              <MoneyInput value={cashOnHand} onChange={setCashOnHand} alignRight={false} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">비고</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="특이사항을 입력하세요"
              />
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting || !totals.isMatched}
            className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {submitting ? "제출 중..." : totals.isMatched ? "제출하기" : "차액이 있어 제출 불가"}
          </button>
        </div>
      </form>
    </main>
  );
}

function MoneyInput({
  value,
  onChange,
  alignRight = true,
}: {
  value: number;
  onChange: (n: number) => void;
  alignRight?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      value={value === 0 ? "" : value}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      placeholder="0"
      className={`w-full px-3 py-1.5 border border-neutral-300 rounded-md outline-none focus:ring-2 focus:ring-brand-500 ${
        alignRight ? "text-right" : "text-left"
      }`}
    />
  );
}

function DiffRow({
  label,
  crm,
  terminal,
  diff,
  bold,
}: {
  label: string;
  crm: number;
  terminal: number;
  diff: number;
  bold?: boolean;
}) {
  const matched = diff === 0;
  const empty = crm === 0 && terminal === 0;
  return (
    <tr className={bold ? "font-semibold" : ""}>
      <td className="px-3 py-2">{label}</td>
      <td className="px-3 py-2 text-right">{formatKRW(crm)}</td>
      <td className="px-3 py-2 text-right">{formatKRW(terminal)}</td>
      <td className={`px-3 py-2 text-right ${matched ? "text-neutral-700" : "text-rose-700 font-bold"}`}>
        {formatKRW(diff)}
      </td>
      <td className="px-3 py-2 text-center">
        {empty ? "-" : matched ? "✓" : "✗"}
      </td>
    </tr>
  );
}
