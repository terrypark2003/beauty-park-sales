"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeTotals, formatKRW } from "@/lib/types";

const TERMINAL_NAMES = [
  "데스크 왼쪽",
  "데스크 오른쪽",
  "상담실 1",
  "상담실 2",
  "상담실 3",
] as const;

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

interface DraftShape {
  author?: string;
  reviewer?: string;
  reportDate?: string;
  crmTaxableCard?: number;
  crmTaxableCashReceipt?: number;
  crmTaxableTransfer?: number;
  crmTaxFreeCard?: number;
  crmTaxFreeCashReceipt?: number;
  crmTaxFreeTransfer?: number;
  terminals?: Array<{ name: string; card: number; cash: number }>;
  cashOnHand?: number;
  transferDetails?: string;
  notes?: string;
  savedAt?: string;
}

export default function ReportPage() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [author, setAuthor] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reportDate, setReportDate] = useState(todayISO());

  const [crmTaxableCard, setCrmTaxableCard] = useState(0);
  const [crmTaxableCashReceipt, setCrmTaxableCashReceipt] = useState(0);
  const [crmTaxableTransfer, setCrmTaxableTransfer] = useState(0);
  const [crmTaxFreeCard, setCrmTaxFreeCard] = useState(0);
  const [crmTaxFreeCashReceipt, setCrmTaxFreeCashReceipt] = useState(0);
  const [crmTaxFreeTransfer, setCrmTaxFreeTransfer] = useState(0);

  const [terminals, setTerminals] = useState<Array<{ name: string; card: number; cash: number }>>(
    TERMINAL_NAMES.map((name) => ({ name: name as string, card: 0, cash: 0 }))
  );

  const [cashOnHand, setCashOnHand] = useState(0);
  const [transferDetails, setTransferDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null);
  const inited = useRef(false);

  const applyDraft = (d: DraftShape, source: "auto" | "manual") => {
    if (d.author) setAuthor(d.author);
    if (d.reviewer !== undefined) setReviewer(d.reviewer);
    if (d.reportDate) setReportDate(d.reportDate);
    setCrmTaxableCard(d.crmTaxableCard || 0);
    setCrmTaxableCashReceipt(d.crmTaxableCashReceipt || 0);
    setCrmTaxableTransfer(d.crmTaxableTransfer || 0);
    setCrmTaxFreeCard(d.crmTaxFreeCard || 0);
    setCrmTaxFreeCashReceipt(d.crmTaxFreeCashReceipt || 0);
    setCrmTaxFreeTransfer(d.crmTaxFreeTransfer || 0);
    if (Array.isArray(d.terminals) && d.terminals.length === TERMINAL_NAMES.length) {
      setTerminals(d.terminals.map((t) => ({ name: t.name, card: t.card || 0, cash: t.cash || 0 })));
    }
    setCashOnHand(d.cashOnHand || 0);
    setTransferDetails(d.transferDetails || "");
    setNotes(d.notes || "");
    const when = d.savedAt ? new Date(d.savedAt).toLocaleString("ko-KR") : "";
    setMessage({
      type: "info",
      text:
        source === "auto"
          ? `서버에 저장된 임시저장을 불러왔습니다${when ? ` (저장 시각: ${when})` : ""}.`
          : `임시저장을 불러왔습니다${when ? ` (저장 시각: ${when})` : ""}.`,
    });
  };

  // Auth gate + initial draft auto-load
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("bp_entered") !== "yes") {
      router.replace("/");
      return;
    }
    if (inited.current) return;
    inited.current = true;

    const entryPw = localStorage.getItem("bp_entry_pw") || "bpdeskteam";
    setPw(entryPw);

    const lastAuthor = localStorage.getItem("bp_last_author") || "";
    if (lastAuthor) {
      setAuthor(lastAuthor);
      // Try fetching server draft for this author
      fetch(`/api/draft?password=${encodeURIComponent(entryPw)}&author=${encodeURIComponent(lastAuthor)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.draft) applyDraft(data.draft as DraftShape, "auto");
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, [router]);

  const totals = useMemo(
    () =>
      computeTotals({
        crmTaxableCard,
        crmTaxableCashReceipt,
        crmTaxableTransfer,
        crmTaxFreeCard,
        crmTaxFreeCashReceipt,
        crmTaxFreeTransfer,
        terminals,
      }),
    [
      crmTaxableCard,
      crmTaxableCashReceipt,
      crmTaxableTransfer,
      crmTaxFreeCard,
      crmTaxFreeCashReceipt,
      crmTaxFreeTransfer,
      terminals,
    ]
  );

  const updateTerminal = (i: number, key: "card" | "cash", value: number) => {
    setTerminals((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [key]: value };
      return next;
    });
  };

  const collectDraft = (): DraftShape => ({
    author,
    reviewer,
    reportDate,
    crmTaxableCard,
    crmTaxableCashReceipt,
    crmTaxableTransfer,
    crmTaxFreeCard,
    crmTaxFreeCashReceipt,
    crmTaxFreeTransfer,
    terminals,
    cashOnHand,
    transferDetails,
    notes,
  });

  const handleSaveDraft = async () => {
    if (!author.trim()) {
      setMessage({ type: "err", text: "임시저장 전에 작성자 이름을 입력하세요." });
      return;
    }
    setSavingDraft(true);
    setMessage(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, author: author.trim(), data: collectDraft() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      localStorage.setItem("bp_last_author", author.trim());
      setMessage({
        type: "ok",
        text: `임시저장 완료. 같은 작성자명(${author.trim()})으로 다른 PC에서 접속해도 자동으로 불러옵니다.`,
      });
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "저장 실패" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = async () => {
    if (!author.trim()) {
      setMessage({ type: "err", text: "작성자 이름을 먼저 입력하세요." });
      return;
    }
    setLoadingDraft(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/draft?password=${encodeURIComponent(pw)}&author=${encodeURIComponent(author.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "불러오기 실패");
      if (!data.draft) {
        setMessage({ type: "info", text: `${author.trim()}의 임시저장이 없습니다.` });
      } else {
        applyDraft(data.draft as DraftShape, "manual");
      }
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "불러오기 실패" });
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!confirm("저장된 임시저장 내용을 삭제하고 폼을 비우시겠습니까?")) return;
    setCrmTaxableCard(0);
    setCrmTaxableCashReceipt(0);
    setCrmTaxableTransfer(0);
    setCrmTaxFreeCard(0);
    setCrmTaxFreeCashReceipt(0);
    setCrmTaxFreeTransfer(0);
    setTerminals(TERMINAL_NAMES.map((name) => ({ name: name as string, card: 0, cash: 0 })));
    setCashOnHand(0);
    setTransferDetails("");
    setNotes("");
    if (author.trim()) {
      try {
        await fetch(
          `/api/draft?password=${encodeURIComponent(pw)}&author=${encodeURIComponent(author.trim())}`,
          { method: "DELETE" }
        );
      } catch {
        /* ignore */
      }
    }
    setMessage({ type: "info", text: "임시저장과 폼 입력을 초기화했습니다." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!author.trim()) {
      setMessage({ type: "err", text: "작성자 이름을 입력하세요." });
      return;
    }
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
          author: author.trim(),
          reviewer,
          crmTaxableCard,
          crmTaxableCashReceipt,
          crmTaxableTransfer,
          crmTaxFreeCard,
          crmTaxFreeCashReceipt,
          crmTaxFreeTransfer,
          terminals,
          cashOnHand,
          transferDetails,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "제출 실패");

      localStorage.setItem("bp_last_author", author.trim());

      // delete server draft on successful submit
      try {
        await fetch(
          `/api/draft?password=${encodeURIComponent(pw)}&author=${encodeURIComponent(author.trim())}`,
          { method: "DELETE" }
        );
      } catch {
        /* ignore */
      }

      setMessage({ type: "ok", text: "제출이 완료되었습니다. 이메일이 발송되었습니다." });
      setCrmTaxableCard(0);
      setCrmTaxableCashReceipt(0);
      setCrmTaxableTransfer(0);
      setCrmTaxFreeCard(0);
      setCrmTaxFreeCashReceipt(0);
      setCrmTaxFreeTransfer(0);
      setTerminals(TERMINAL_NAMES.map((name) => ({ name: name as string, card: 0, cash: 0 })));
      setCashOnHand(0);
      setTransferDetails("");
      setNotes("");
    } catch (err) {
      setMessage({ type: "err", text: err instanceof Error ? err.message : "제출 실패" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bp_entered");
    localStorage.removeItem("bp_entry_pw");
    router.push("/");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">뷰티파크의원 일일 매출 보고서</h1>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/history" className="text-sm text-brand-600 hover:underline font-medium">
            전체 제출 기록 →
          </Link>
          <button onClick={handleLogout} className="text-sm text-neutral-600 hover:text-neutral-900">
            로그아웃
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">작성자 *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="flex-1 min-w-0 px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
                <button
                  type="button"
                  onClick={handleLoadDraft}
                  disabled={loadingDraft || !author.trim()}
                  title="이 작성자명으로 다른 PC에서 저장한 임시저장을 불러옵니다"
                  className="shrink-0 px-2 text-xs border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50 rounded-md whitespace-nowrap"
                >
                  {loadingDraft ? "..." : "불러오기"}
                </button>
              </div>
            </div>
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

        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900 mb-1">1. CRM 매출 입력</h2>
          <p className="text-sm text-neutral-500 mb-4">CRM 항목별 수납내역을 입력하세요</p>
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
                  <td className="px-3 py-2" rowSpan={3}>비보험(면세)</td>
                  <td className="px-3 py-2">카드</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxFreeCard} onChange={setCrmTaxFreeCard} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2">현금영수증</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxFreeCashReceipt} onChange={setCrmTaxFreeCashReceipt} /></td>
                </tr>
                <tr>
                  <td className="px-3 py-2">통장입금</td>
                  <td className="px-3 py-2"><MoneyInput value={crmTaxFreeTransfer} onChange={setCrmTaxFreeTransfer} /></td>
                </tr>
                <tr className="bg-brand-50 font-semibold">
                  <td className="px-3 py-2" colSpan={2}>CRM 총 매출</td>
                  <td className="px-3 py-2 text-right">{formatKRW(totals.crmGrandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

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

        <section
          className={`rounded-xl border p-5 ${
            totals.isMatched ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
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

        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">4. 시재 · 이체 내역 · 비고</h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">현금 시재</label>
              <MoneyInput value={cashOnHand} onChange={setCashOnHand} alignRight={false} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">이체 내역</label>
              <textarea
                value={transferDetails}
                onChange={(e) => setTransferDetails(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="예) 홍길동 / 100,000원 / 14:30 / 신한 1234"
              />
              <p className="text-xs text-neutral-500 mt-1">이체로 받은 내역을 자유롭게 입력하세요 (이름·금액·시간·은행 등)</p>
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
                : message.type === "info"
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <button
            type="submit"
            disabled={submitting || !totals.isMatched}
            className="flex-1 min-w-[200px] bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {submitting ? "제출 중..." : totals.isMatched ? "제출하기" : "차액이 있어 제출 불가"}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-4 py-3 border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50 font-semibold rounded-lg"
          >
            {savingDraft ? "저장 중..." : "임시 저장"}
          </button>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="px-4 py-3 border border-neutral-300 text-neutral-600 hover:bg-neutral-100 font-semibold rounded-lg"
          >
            초기화
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
  const display = value === 0 ? "" : value.toLocaleString("ko-KR");
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        onChange(raw === "" ? 0 : Number(raw));
      }}
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
