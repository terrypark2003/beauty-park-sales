"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SalesReport, computeTotals, formatKRW, isFullyConfirmed } from "@/lib/types";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("bp_admin_pw");
    if (saved) {
      setPassword(saved);
      load(saved);
    }
  }, []);

  const load = async (pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports?password=${encodeURIComponent(pw)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setReports(data.reports || []);
      setAuthed(true);
      sessionStorage.setItem("bp_admin_pw", pw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "조회 실패";
      setError(msg);
      setAuthed(false);
      sessionStorage.removeItem("bp_admin_pw");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = (next: SalesReport) => {
    setReports((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  };

  const removeReport = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filterAuthor && !r.author.includes(filterAuthor)) return false;
      if (filterFrom && r.reportDate < filterFrom) return false;
      if (filterTo && r.reportDate > filterTo) return false;
      return true;
    });
  }, [reports, filterAuthor, filterFrom, filterTo]);

  const aggregate = useMemo(() => {
    let crm = 0;
    let term = 0;
    let confirmed = 0;
    filtered.forEach((r) => {
      const t = computeTotals(r);
      crm += t.crmGrandTotal;
      term += t.terminalGrandTotal;
      if (isFullyConfirmed(r)) confirmed += 1;
    });
    return { crm, term, count: filtered.length, confirmed };
  }, [filtered]);

  const exportCSV = () => {
    const header = [
      "id",
      "작성일자",
      "작성자",
      "검토자",
      "비보험과세_카드",
      "비보험과세_현금영수증",
      "비보험과세_통장입금",
      "비보험면세_카드",
      "비보험면세_현금영수증",
      "비보험면세_통장입금",
      "단말기_카드합계",
      "단말기_현금합계",
      "CRM총매출",
      "단말기총매출",
      "현금시재",
      "이체내역",
      "비고",
      "CRM확인",
      "단말기확인",
      "매출컨펌",
      "컨펌시각",
      "최종수정",
      "제출시각",
    ];
    const rows = filtered.map((r) => {
      const t = computeTotals(r);
      return [
        r.id,
        r.reportDate,
        r.author,
        r.reviewer || "",
        r.crmTaxableCard,
        r.crmTaxableCashReceipt,
        r.crmTaxableTransfer,
        r.crmTaxFreeCard,
        r.crmTaxFreeCashReceipt || 0,
        r.crmTaxFreeTransfer || 0,
        t.terminalCardTotal,
        t.terminalCashTotal,
        t.crmGrandTotal,
        t.terminalGrandTotal,
        r.cashOnHand,
        (r.transferDetails || "").replace(/[\n\r,"]/g, " "),
        (r.notes || "").replace(/[\n\r,"]/g, " "),
        r.crmConfirmed ? "Y" : "",
        r.terminalConfirmed ? "Y" : "",
        r.salesConfirmed ? "Y" : "",
        r.confirmedAt || "",
        r.lastEditedAt || "",
        r.submittedAt,
      ].join(",");
    });
    const csv = "﻿" + [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bp-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(password);
          }}
          className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-neutral-200 p-8"
        >
          <h1 className="text-xl font-bold mb-1">관리자 페이지</h1>
          <p className="text-sm text-neutral-500 mb-6">비밀번호를 입력하세요</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 mb-4"
            placeholder="ADMIN_PASSWORD"
            autoFocus
          />
          {error && <div className="text-sm text-rose-600 mb-3">{error}</div>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white font-semibold py-3 rounded-lg"
          >
            {loading ? "확인 중..." : "들어가기"}
          </button>
          <a href="/" className="block text-center mt-4 text-sm text-neutral-500 hover:text-brand-600">
            ← 홈으로
          </a>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">전체 매출 보고서</h1>
          <p className="text-sm text-neutral-500 mt-1">최신순 정렬, 최대 500건</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(password)}
            className="px-3 py-2 text-sm border border-neutral-300 rounded-lg hover:bg-neutral-100"
          >
            새로고침
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="px-3 py-2 text-sm bg-brand-600 hover:bg-brand-700 disabled:bg-neutral-300 text-white rounded-lg"
          >
            CSV 다운로드
          </button>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-neutral-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-neutral-600">작성자</label>
          <input
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm"
            placeholder="이름 검색"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-600">시작일</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-600">종료일</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm"
          />
        </div>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="건수" value={`${aggregate.count}건`} />
        <Stat label="컨펌 완료" value={`${aggregate.confirmed}건`} />
        <Stat label="CRM 합계" value={formatKRW(aggregate.crm) + "원"} />
        <Stat label="단말기 합계" value={formatKRW(aggregate.term) + "원"} />
      </section>

      <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-neutral-700">
                <th className="text-left px-3 py-2 font-medium">작성일</th>
                <th className="text-left px-3 py-2 font-medium">작성자</th>
                <th className="text-right px-3 py-2 font-medium">CRM</th>
                <th className="text-right px-3 py-2 font-medium">단말기</th>
                <th className="text-center px-3 py-2 font-medium">일치</th>
                <th className="text-center px-3 py-2 font-medium">CRM 확인</th>
                <th className="text-center px-3 py-2 font-medium">단말기 확인</th>
                <th className="text-center px-3 py-2 font-medium">매출 컨펌</th>
                <th className="text-left px-3 py-2 font-medium">컨펌시각</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-neutral-500">
                    {loading ? "불러오는 중..." : "보고서가 없습니다."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const t = computeTotals(r);
                const isOpen = openId === r.id;
                const isEditing = editingId === r.id;
                const fullyConfirmed = isFullyConfirmed(r);
                return (
                  <Fragment key={r.id}>
                    <tr className={`hover:bg-neutral-50 ${fullyConfirmed ? "bg-emerald-50/40" : ""}`}>
                      <td className="px-3 py-2">{r.reportDate}</td>
                      <td className="px-3 py-2">{r.author}</td>
                      <td className="px-3 py-2 text-right">{formatKRW(t.crmGrandTotal)}</td>
                      <td className="px-3 py-2 text-right">{formatKRW(t.terminalGrandTotal)}</td>
                      <td className="px-3 py-2 text-center">
                        {t.isMatched ? <span className="text-emerald-600">✓</span> : <span className="text-rose-600">✗</span>}
                      </td>
                      <ConfirmCell field="crmConfirmed" report={r} password={password} onUpdate={updateReport} />
                      <ConfirmCell field="terminalConfirmed" report={r} password={password} onUpdate={updateReport} />
                      <ConfirmCell field="salesConfirmed" report={r} password={password} onUpdate={updateReport} />
                      <td className="px-3 py-2 text-xs text-neutral-600">
                        {r.confirmedAt ? new Date(r.confirmedAt).toLocaleString("ko-KR") : "-"}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            if (isOpen) {
                              setOpenId(null);
                              if (editingId === r.id) setEditingId(null);
                            } else {
                              setOpenId(r.id);
                            }
                          }}
                          className="text-xs text-brand-600 hover:underline mr-2"
                        >
                          {isOpen ? "닫기" : "상세"}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`${r.reportDate} ${r.author}의 보고서를 삭제하시겠습니까?\n(데이터는 보존되지만 목록에서 제거됩니다)`)) return;
                            const res = await fetch(`/api/admin/report?password=${encodeURIComponent(password)}&id=${encodeURIComponent(r.id)}`, {
                              method: "DELETE",
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              alert(data.error || "삭제 실패");
                              return;
                            }
                            removeReport(r.id);
                          }}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-neutral-50">
                        <td colSpan={10} className="px-4 py-4">
                          {isEditing ? (
                            <EditForm
                              report={r}
                              password={password}
                              onCancel={() => setEditingId(null)}
                              onSaved={(next) => {
                                updateReport(next);
                                setEditingId(null);
                              }}
                            />
                          ) : (
                            <Detail
                              report={r}
                              onEdit={() => setEditingId(r.id)}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function ConfirmCell({
  field,
  report,
  password,
  onUpdate,
}: {
  field: "crmConfirmed" | "terminalConfirmed" | "salesConfirmed";
  report: SalesReport;
  password: string;
  onUpdate: (r: SalesReport) => void;
}) {
  const checked = Boolean(report[field]);
  const [busy, setBusy] = useState(false);
  return (
    <td className="px-3 py-2 text-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.checked;
          setBusy(true);
          try {
            const res = await fetch("/api/admin/report", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                password,
                id: report.id,
                patch: { [field]: next },
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "업데이트 실패");
            onUpdate(data.report);
          } catch (err) {
            alert(err instanceof Error ? err.message : "업데이트 실패");
          } finally {
            setBusy(false);
          }
        }}
        className="w-4 h-4 accent-brand-600 cursor-pointer"
      />
    </td>
  );
}

function Detail({ report, onEdit }: { report: SalesReport; onEdit: () => void }) {
  const t = computeTotals(report);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex justify-end">
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium"
        >
          수정하기
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">CRM 매출</h4>
          <ul className="space-y-1">
            <li className="flex justify-between"><span>비보험(과세) 카드</span><span>{formatKRW(report.crmTaxableCard)}</span></li>
            <li className="flex justify-between"><span>비보험(과세) 현금영수증</span><span>{formatKRW(report.crmTaxableCashReceipt)}</span></li>
            <li className="flex justify-between"><span>비보험(과세) 통장입금</span><span>{formatKRW(report.crmTaxableTransfer)}</span></li>
            <li className="flex justify-between"><span>비보험(면세) 카드</span><span>{formatKRW(report.crmTaxFreeCard)}</span></li>
            <li className="flex justify-between"><span>비보험(면세) 현금영수증</span><span>{formatKRW(report.crmTaxFreeCashReceipt || 0)}</span></li>
            <li className="flex justify-between"><span>비보험(면세) 통장입금</span><span>{formatKRW(report.crmTaxFreeTransfer || 0)}</span></li>
            <li className="flex justify-between font-semibold pt-1 border-t"><span>총 매출</span><span>{formatKRW(t.crmGrandTotal)}</span></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-2">단말기 매출</h4>
          <table className="w-full">
            <thead>
              <tr className="text-neutral-600">
                <th className="text-left">단말기</th>
                <th className="text-right">카드</th>
                <th className="text-right">현금/이체</th>
              </tr>
            </thead>
            <tbody>
              {report.terminals.map((tt, i) => (
                <tr key={i}>
                  <td>{tt.name}</td>
                  <td className="text-right">{formatKRW(tt.card)}</td>
                  <td className="text-right">{formatKRW(tt.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
            <span>총 매출</span><span>{formatKRW(t.terminalGrandTotal)}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span><span className="text-neutral-500">검토자:</span> {report.reviewer || "-"}</span>
          <span><span className="text-neutral-500">현금 시재:</span> {formatKRW(report.cashOnHand)}원</span>
          {report.lastEditedAt && (
            <span><span className="text-neutral-500">최종 수정:</span> {new Date(report.lastEditedAt).toLocaleString("ko-KR")}</span>
          )}
        </div>
        {report.transferDetails && (
          <div>
            <div className="text-neutral-500 text-xs">이체 내역</div>
            <div className="whitespace-pre-wrap">{report.transferDetails}</div>
          </div>
        )}
        {report.notes && (
          <div>
            <div className="text-neutral-500 text-xs">비고</div>
            <div className="whitespace-pre-wrap">{report.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditForm({
  report,
  password,
  onCancel,
  onSaved,
}: {
  report: SalesReport;
  password: string;
  onCancel: () => void;
  onSaved: (r: SalesReport) => void;
}) {
  const [reportDate, setReportDate] = useState(report.reportDate);
  const [reviewer, setReviewer] = useState(report.reviewer || "");
  const [crmTaxableCard, setCrmTaxableCard] = useState(report.crmTaxableCard);
  const [crmTaxableCashReceipt, setCrmTaxableCashReceipt] = useState(report.crmTaxableCashReceipt);
  const [crmTaxableTransfer, setCrmTaxableTransfer] = useState(report.crmTaxableTransfer);
  const [crmTaxFreeCard, setCrmTaxFreeCard] = useState(report.crmTaxFreeCard);
  const [crmTaxFreeCashReceipt, setCrmTaxFreeCashReceipt] = useState(report.crmTaxFreeCashReceipt || 0);
  const [crmTaxFreeTransfer, setCrmTaxFreeTransfer] = useState(report.crmTaxFreeTransfer || 0);
  const [terminals, setTerminals] = useState(report.terminals.map((t) => ({ ...t })));
  const [cashOnHand, setCashOnHand] = useState(report.cashOnHand);
  const [transferDetails, setTransferDetails] = useState(report.transferDetails || "");
  const [notes, setNotes] = useState(report.notes || "");
  const [saving, setSaving] = useState(false);

  const totals = computeTotals({
    crmTaxableCard,
    crmTaxableCashReceipt,
    crmTaxableTransfer,
    crmTaxFreeCard,
    crmTaxFreeCashReceipt,
    crmTaxFreeTransfer,
    terminals,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/report", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          id: report.id,
          patch: {
            reportDate,
            reviewer: reviewer.trim() || undefined,
            crmTaxableCard: Number(crmTaxableCard) || 0,
            crmTaxableCashReceipt: Number(crmTaxableCashReceipt) || 0,
            crmTaxableTransfer: Number(crmTaxableTransfer) || 0,
            crmTaxFreeCard: Number(crmTaxFreeCard) || 0,
            crmTaxFreeCashReceipt: Number(crmTaxFreeCashReceipt) || 0,
            crmTaxFreeTransfer: Number(crmTaxFreeTransfer) || 0,
            terminals: terminals.map((t) => ({
              name: t.name,
              card: Number(t.card) || 0,
              cash: Number(t.cash) || 0,
            })),
            cashOnHand: Number(cashOnHand) || 0,
            transferDetails,
            notes,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      onSaved(data.report);
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const num = (v: number, set: (n: number) => void) => (
    <input
      type="number"
      min={0}
      value={v === 0 ? "" : v}
      onChange={(e) => set(Number(e.target.value || 0))}
      placeholder="0"
      className="w-full px-2 py-1 border border-neutral-300 rounded text-right"
    />
  );

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="font-semibold text-neutral-700">매출 보고서 수정 - {report.author}</div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs border border-neutral-300 rounded-md"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-md font-medium"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-600 mb-1">작성일자</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-600 mb-1">검토자</label>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold mb-2">CRM 매출</h4>
          <table className="w-full">
            <tbody className="divide-y divide-neutral-200">
              <tr><td className="py-1">비보험(과세) 카드</td><td className="py-1 w-32">{num(crmTaxableCard, setCrmTaxableCard)}</td></tr>
              <tr><td className="py-1">비보험(과세) 현금영수증</td><td className="py-1">{num(crmTaxableCashReceipt, setCrmTaxableCashReceipt)}</td></tr>
              <tr><td className="py-1">비보험(과세) 통장입금</td><td className="py-1">{num(crmTaxableTransfer, setCrmTaxableTransfer)}</td></tr>
              <tr><td className="py-1">비보험(면세) 카드</td><td className="py-1">{num(crmTaxFreeCard, setCrmTaxFreeCard)}</td></tr>
              <tr><td className="py-1">비보험(면세) 현금영수증</td><td className="py-1">{num(crmTaxFreeCashReceipt, setCrmTaxFreeCashReceipt)}</td></tr>
              <tr><td className="py-1">비보험(면세) 통장입금</td><td className="py-1">{num(crmTaxFreeTransfer, setCrmTaxFreeTransfer)}</td></tr>
              <tr className="font-semibold"><td className="pt-2">총 매출</td><td className="pt-2 text-right">{formatKRW(totals.crmGrandTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="font-semibold mb-2">단말기 매출</h4>
          <table className="w-full">
            <thead>
              <tr className="text-neutral-600 text-xs">
                <th className="text-left">단말기</th>
                <th className="text-right w-24">카드</th>
                <th className="text-right w-24">현금/이체</th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((t, i) => (
                <tr key={i}>
                  <td>{t.name}</td>
                  <td className="py-1">{num(t.card, (v) => setTerminals((p) => p.map((x, j) => (j === i ? { ...x, card: v } : x))))}</td>
                  <td className="py-1">{num(t.cash, (v) => setTerminals((p) => p.map((x, j) => (j === i ? { ...x, cash: v } : x))))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-2">총 매출</td>
                <td colSpan={2} className="pt-2 text-right">{formatKRW(totals.terminalGrandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={`rounded-md border p-3 text-xs ${
          totals.isMatched ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
        }`}
      >
        차액 - 카드: {formatKRW(totals.cardDiff)} / 현금이체: {formatKRW(totals.cashDiff)} / 총: {formatKRW(totals.totalDiff)}{" "}
        {totals.isMatched ? "(✓ 일치)" : "(✗ 불일치 - 저장은 가능하지만 다시 확인 필요)"}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs text-neutral-600 mb-1">현금 시재</label>
          <input
            type="number"
            min={0}
            value={cashOnHand === 0 ? "" : cashOnHand}
            onChange={(e) => setCashOnHand(Number(e.target.value || 0))}
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-600 mb-1">이체 내역</label>
          <textarea
            value={transferDetails}
            onChange={(e) => setTransferDetails(e.target.value)}
            rows={3}
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-600 mb-1">비고</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-1.5 border border-neutral-300 rounded-md"
          />
        </div>
      </div>
    </div>
  );
}
