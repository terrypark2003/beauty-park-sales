"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { SalesReport, computeTotals, formatKRW } from "@/lib/types";

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
    filtered.forEach((r) => {
      const t = computeTotals(r);
      crm += t.crmGrandTotal;
      term += t.terminalGrandTotal;
    });
    return { crm, term, count: filtered.length };
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
      "단말기_카드합계",
      "단말기_현금합계",
      "CRM총매출",
      "단말기총매출",
      "현금시재",
      "비고",
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
        t.terminalCardTotal,
        t.terminalCashTotal,
        t.crmGrandTotal,
        t.terminalGrandTotal,
        r.cashOnHand,
        (r.notes || "").replace(/[\n\r,"]/g, " "),
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
    <main className="max-w-6xl mx-auto px-4 py-8">
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

      {/* Filters */}
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

      {/* Aggregate */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="건수" value={`${aggregate.count}건`} />
        <Stat label="CRM 합계" value={formatKRW(aggregate.crm) + "원"} />
        <Stat label="단말기 합계" value={formatKRW(aggregate.term) + "원"} />
      </section>

      {/* Table */}
      <section className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-neutral-700">
                <th className="text-left px-3 py-2 font-medium">작성일</th>
                <th className="text-left px-3 py-2 font-medium">작성자</th>
                <th className="text-right px-3 py-2 font-medium">CRM 매출</th>
                <th className="text-right px-3 py-2 font-medium">단말기 매출</th>
                <th className="text-center px-3 py-2 font-medium">일치</th>
                <th className="text-left px-3 py-2 font-medium">제출시각</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-500">
                    {loading ? "불러오는 중..." : "보고서가 없습니다."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const t = computeTotals(r);
                const isOpen = openId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-neutral-50">
                      <td className="px-3 py-2">{r.reportDate}</td>
                      <td className="px-3 py-2">{r.author}</td>
                      <td className="px-3 py-2 text-right">{formatKRW(t.crmGrandTotal)}</td>
                      <td className="px-3 py-2 text-right">{formatKRW(t.terminalGrandTotal)}</td>
                      <td className="px-3 py-2 text-center">
                        {t.isMatched ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-rose-600">✗</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-500 text-xs">
                        {new Date(r.submittedAt).toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setOpenId(isOpen ? null : r.id)}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          {isOpen ? "닫기" : "상세"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-neutral-50">
                        <td colSpan={7} className="px-4 py-4">
                          <Detail r={r} />
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

function Detail({ r }: { r: SalesReport }) {
  const t = computeTotals(r);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div>
        <h4 className="font-semibold mb-2">CRM 매출</h4>
        <ul className="space-y-1">
          <li className="flex justify-between"><span>비보험(과세) 카드</span><span>{formatKRW(r.crmTaxableCard)}</span></li>
          <li className="flex justify-between"><span>비보험(과세) 현금영수증</span><span>{formatKRW(r.crmTaxableCashReceipt)}</span></li>
          <li className="flex justify-between"><span>비보험(과세) 통장입금</span><span>{formatKRW(r.crmTaxableTransfer)}</span></li>
          <li className="flex justify-between"><span>비보험(면세) 카드</span><span>{formatKRW(r.crmTaxFreeCard)}</span></li>
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
            {r.terminals.map((tt, i) => (
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
      <div className="md:col-span-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span><span className="text-neutral-500">검토자:</span> {r.reviewer || "-"}</span>
          <span><span className="text-neutral-500">현금 시재:</span> {formatKRW(r.cashOnHand)}원</span>
        </div>
        {r.notes && (
          <div className="mt-2">
            <div className="text-neutral-500 text-xs">비고</div>
            <div className="whitespace-pre-wrap">{r.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
