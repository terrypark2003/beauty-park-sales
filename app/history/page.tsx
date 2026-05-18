"use client";

// 로그인한 사용자가 전체 매출 보고서 목록을 작성자·날짜 필터와 함께 조회하는 페이지
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SalesReport, computeTotals, formatKRW } from "@/lib/types";

const ENTRY_PASSWORD = "BPDESKTEAM202605";

export default function HistoryPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("bp_entered") !== "yes") {
      router.replace("/");
      return;
    }
    const pw = localStorage.getItem("bp_entry_pw") || ENTRY_PASSWORD;
    fetch(`/api/all-reports?password=${encodeURIComponent(pw)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setReports(d.reports || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filterAuthor && !r.author.includes(filterAuthor)) return false;
      if (filterFrom && r.reportDate < filterFrom) return false;
      if (filterTo && r.reportDate > filterTo) return false;
      return true;
    });
  }, [reports, filterAuthor, filterFrom, filterTo]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">전체 제출 기록</h1>
          <p className="text-sm text-neutral-500 mt-1">최신순 정렬, 최대 500건</p>
        </div>
        <Link
          href="/report"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg"
        >
          ← 보고서 작성으로
        </Link>
      </div>

      <section className="bg-white rounded-xl border border-neutral-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-neutral-600">작성자 검색</label>
          <input
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm"
            placeholder="이름 일부 입력"
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

      {loading && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center text-neutral-500">
          불러오는 중...
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center text-neutral-500">
          {reports.length === 0 ? "아직 제출된 보고서가 없습니다." : "조건에 맞는 보고서가 없습니다."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
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
        </div>
      )}
    </main>
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
          <li className="flex justify-between"><span>비보험(면세) 현금영수증</span><span>{formatKRW(r.crmTaxFreeCashReceipt || 0)}</span></li>
          <li className="flex justify-between"><span>비보험(면세) 통장입금</span><span>{formatKRW(r.crmTaxFreeTransfer || 0)}</span></li>
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
      <div className="md:col-span-2 space-y-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          <span><span className="text-neutral-500">검토자:</span> {r.reviewer || "-"}</span>
          <span><span className="text-neutral-500">현금 시재:</span> {formatKRW(r.cashOnHand)}원</span>
        </div>
        {r.transferDetails && (
          <div>
            <div className="text-neutral-500 text-xs">이체 내역</div>
            <div className="whitespace-pre-wrap">{r.transferDetails}</div>
          </div>
        )}
        {r.notes && (
          <div>
            <div className="text-neutral-500 text-xs">비고</div>
            <div className="whitespace-pre-wrap">{r.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
