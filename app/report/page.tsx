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

type StepNum = 1 | 2 | 3;

const todayISO = () => {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

interface DraftShape {
  step?: StepNum;
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
  const [step, setStep] = useState<StepNum>(1);

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
    if (d.step === 1 || d.step === 2 || d.step === 3) setStep(d.step);
    const when = d.savedAt ? new Date(d.savedAt).toLocaleString("ko-KR") : "";
    setMessage({
      type: "info",
      text:
        source === "auto"
          ? `서버 임시저장을 불러왔습니다${when ? ` (저장 시각: ${when})` : ""}.`
          : `임시저장을 불러왔습니다${when ? ` (저장 시각: ${when})` : ""}.`,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("bp_entered") !== "yes") {
      router.replace("/");
      return;
    }
    if (inited.current) return;
    inited.current = true;

    const entryPw = localStorage.getItem("bp_entry_pw") || "BPDESKTEAM202605";
    setPw(entryPw);

    const lastAuthor = localStorage.getItem("bp_last_author") || "";
    if (lastAuthor) {
      setAuthor(lastAuthor);
      fetch(`/api/draft?password=${encodeURIComponent(entryPw)}&author=${encodeURIComponent(lastAuthor)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.draft) applyDraft(data.draft as DraftShape, "auto");
        })
        .catch(() => {});
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
    step,
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
        text: `임시저장 완료. 같은 작성자명(${author.trim()})으로 다른 PC에서도 자동 복구됩니다.`,
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
    setStep(1);
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
      } catch {}
    }
    setMessage({ type: "info", text: "임시저장과 폼 입력을 초기화했습니다." });
  };

  const goNextFromStep1 = () => {
    setMessage(null);
    if (!author.trim()) {
      setMessage({ type: "err", text: "작성자 이름을 입력하세요." });
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goNextFromStep2 = () => {
    setMessage(null);
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = (to: StepNum) => {
    setMessage(null);
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setMessage(null);
    if (!author.trim()) {
      setMessage({ type: "err", text: "작성자 이름을 입력하세요." });
      return;
    }
    if (!totals.isMatched) {
      setMessage({ type: "err", text: "차액이 0원이어야 제출할 수 있습니다." });
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
      try {
        await fetch(
          `/api/draft?password=${encodeURIComponent(pw)}&author=${encodeURIComponent(author.trim())}`,
          { method: "DELETE" }
        );
      } catch {}

      setMessage({ type: "ok", text: "제출이 완료되었습니다. 이메일이 발송되었습니다." });
      setStep(1);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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

  const terminalCardTotal = totals.terminalCardTotal;
  const terminalCashTotal = totals.terminalCashTotal;
  const terminalGrandTotal = totals.terminalGrandTotal;

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

      <StepIndicator step={step} />

      {/* ===== Step 1: CRM ===== */}
      {step === 1 && (
        <div className="space-y-6">
          <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-amber-900">📖 사용법</h2>
            <div className="mt-4 space-y-5 text-sm text-amber-950">
              <div>
                <h3 className="font-semibold mb-2">1. CRM 매출 입력 (이번 단계)</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>CRM에서 <strong>수납 조회</strong>를 클릭합니다.</li>
                  <li><strong>금일</strong>을 선택합니다.</li>
                  <li>
                    <strong>조회</strong>를 누릅니다.
                    <ul className="list-[circle] pl-5 mt-1 space-y-1">
                      <li>
                        우측에 나온 <strong>항목별 수납내역</strong>을 찾습니다.
                        <ul className="list-[square] pl-5 mt-1 space-y-1">
                          <li>&apos;카드&apos;란을 <strong>비보험(과세) - 카드</strong> 란으로 옮겨 적습니다.</li>
                          <li>&apos;현금&apos;란을 <strong>비보험(과세) - 현금영수증</strong> 란으로 옮겨 적습니다.</li>
                          <li>&apos;통장입금&apos;을 <strong>비보험(과세) - 통장입금</strong> 란으로 옮겨 적습니다.</li>
                        </ul>
                      </li>
                    </ul>
                  </li>
                </ul>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-md">
                  ⚠️ 반드시 <strong>CRM 상 데이터</strong>를 그대로 옮겨 적어주세요. 단말기 매출을 더해서 CRM 칸을 채우면 안 됩니다. 단말기는 다음 단계에서 따로 입력합니다.
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. 단말기 매출 입력 (다음 단계)</h3>
                <p>각 데스크에서 단말기 <strong>총 카드 금액</strong>과 <strong>현금/이체 금액</strong>을 확인하여 기록합니다.</p>
              </div>
              <div className="p-3 bg-white border border-amber-300 rounded-md">
                💡 마지막 검토 단계에서 CRM 금액과 단말기 금액이 자동으로 비교됩니다. 차액이 있으면 어디서 오류가 났는지 확인이 필요합니다.
              </div>
            </div>
          </section>

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

          {message && <MessageBox message={message} />}

          <NavButtons
            onSaveDraft={handleSaveDraft}
            onDiscard={handleDiscardDraft}
            savingDraft={savingDraft}
            right={
              <button
                type="button"
                onClick={goNextFromStep1}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg"
              >
                단말기 입력으로 →
              </button>
            }
          />
        </div>
      )}

      {/* ===== Step 2: Terminal (CRM hidden) ===== */}
      {step === 2 && (
        <div className="space-y-6">
          <section className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-blue-900">2단계 · 단말기 매출 입력</h2>
            <p className="text-sm text-blue-900 mt-2">
              각 데스크/상담실의 단말기에서 <strong>총 카드 금액</strong>과 <strong>현금/이체 금액</strong>을 확인해 입력하세요.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              ℹ️ CRM 금액은 이 단계에서 보이지 않습니다. 단말기 실제 금액 그대로 입력해주세요. 비교는 다음 검토 단계에서 자동으로 됩니다.
            </p>
          </section>

          <section className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">단말기 매출 입력</h2>
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
                    <td className="px-3 py-2">단말기 합계</td>
                    <td className="px-3 py-2 text-right">{formatKRW(terminalCardTotal)}</td>
                    <td className="px-3 py-2 text-right">{formatKRW(terminalCashTotal)}</td>
                    <td className="px-3 py-2 text-right">{formatKRW(terminalGrandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {message && <MessageBox message={message} />}

          <NavButtons
            onSaveDraft={handleSaveDraft}
            onDiscard={handleDiscardDraft}
            savingDraft={savingDraft}
            left={
              <button
                type="button"
                onClick={() => goBack(1)}
                className="px-4 py-3 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold rounded-lg"
              >
                ← CRM 수정
              </button>
            }
            right={
              <button
                type="button"
                onClick={goNextFromStep2}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg"
              >
                검토 →
              </button>
            }
          />
        </div>
      )}

      {/* ===== Step 3: Review & Submit ===== */}
      {step === 3 && (
        <div className="space-y-6">
          <section
            className={`rounded-xl border p-5 ${
              totals.isMatched ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
            }`}
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">3단계 · 검토 및 제출</h2>
            <p className="text-sm text-neutral-600 mb-4">CRM과 단말기 금액의 일치 여부를 확인하세요</p>
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
              {totals.isMatched ? "✓ 모든 항목이 일치합니다. 제출 가능합니다." : "✗ 차액이 있습니다. 어느 단계로 돌아가 수정하세요."}
            </div>
            {!totals.isMatched && (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => goBack(1)}
                  className="px-3 py-2 text-sm border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-md"
                >
                  ← CRM 다시 보기
                </button>
                <button
                  type="button"
                  onClick={() => goBack(2)}
                  className="px-3 py-2 text-sm border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-md"
                >
                  ← 단말기 다시 보기
                </button>
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-neutral-200 p-5">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">시재 · 이체 내역 · 비고</h2>
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
                <p className="text-xs text-neutral-500 mt-1">이체로 받은 내역을 자유롭게 입력하세요</p>
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

          {message && <MessageBox message={message} />}

          <NavButtons
            onSaveDraft={handleSaveDraft}
            onDiscard={handleDiscardDraft}
            savingDraft={savingDraft}
            left={
              <button
                type="button"
                onClick={() => goBack(2)}
                className="px-4 py-3 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-semibold rounded-lg"
              >
                ← 단말기 수정
              </button>
            }
            right={
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !totals.isMatched}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
              >
                {submitting ? "제출 중..." : totals.isMatched ? "제출하기" : "차액 있어 제출 불가"}
              </button>
            }
          />
        </div>
      )}
    </main>
  );
}

function StepIndicator({ step }: { step: StepNum }) {
  const items: Array<{ n: StepNum; label: string }> = [
    { n: 1, label: "CRM 입력" },
    { n: 2, label: "단말기 입력" },
    { n: 3, label: "검토·제출" },
  ];
  return (
    <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
      {items.map((it, idx) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border ${
                active
                  ? "bg-brand-600 text-white border-brand-600 font-semibold"
                  : done
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-white text-neutral-500 border-neutral-300"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/30 inline-flex items-center justify-center text-xs">
                {done ? "✓" : it.n}
              </span>
              <span>{it.label}</span>
            </div>
            {idx < items.length - 1 && <span className="text-neutral-300">─</span>}
          </div>
        );
      })}
    </div>
  );
}

function NavButtons({
  onSaveDraft,
  onDiscard,
  savingDraft,
  left,
  right,
}: {
  onSaveDraft: () => void;
  onDiscard: () => void;
  savingDraft: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 flex-wrap items-center justify-between">
      <div className="flex gap-2 flex-wrap">
        {left}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={savingDraft}
          className="px-4 py-3 border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50 font-semibold rounded-lg"
        >
          {savingDraft ? "저장 중..." : "임시 저장"}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-4 py-3 border border-neutral-300 text-neutral-600 hover:bg-neutral-100 font-semibold rounded-lg"
        >
          초기화
        </button>
      </div>
      {right}
    </div>
  );
}

function MessageBox({ message }: { message: { type: "ok" | "err" | "info"; text: string } }) {
  return (
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
