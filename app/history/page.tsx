"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SalesReport, computeTotals, formatKRW } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [author, setAuthor] = useState("");
  const [reports, setReports] = useState<SalesReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("bp_user_name") : null;
    if (!saved) {
      router.replace("/");
      return;
    }
    setAuthor(saved);
    fetch(`/api/my-reports?author=${encodeURIComponent(saved)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setReports(d.reports || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">내 제출 기록</h1>
          <p className="text-sm text-neutral-500 mt-1">
            작성자: <span className="font-semibold text-neutral-700">{author}</span>
            <span className="ml-2 text-neutral-400">· 최신순 정렬, 최대 200건</span>
          </p>
        </div>
        <Link
          href="/report"
          className="text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold px-4 py-2 rounded-lg"
        >
          ← 보고서 작성으로
        </Link>
      </div>

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

      {!loading && !error && reports.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center text-neutral-500">
          아직 제출한 보고서가 없습니다.
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 text-neutral-700">
                  <th className="text-left px-3 py-2 font-medium">작성일</th>
                  <th className="text-right px-3 py-2 font-medium">CRM 매출</th>
                  <th className="text-right px-3 py-2 font-medium">단말기 매출</th>
                  <th className="text-center px-3 py-2 font-medium">일치</th>
                  <th className="text-left px-3 py-2 font-medium">제출시각</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {reports.map((r) => {
                  const t = computeTotals(r);
                  const isOpen = openId === r.id;
                  return (
                    <RowAndDetail
                      key={r.id}
                      r={r}
                      totals={t}
                      isOpen={isOpen}
                      onToggle={() => setOpenId(isOpen ? null : r.id)}
                    />
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

function RowAndDetail({
  r,
  totals,
  isOpen,
  onToggle,
}: {
  r: SalesReport;
  totals: ReturnType<typeof computeTotals>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-neutral-50">
        <td className="px-3 py-2">{r.reportDate}</td>
        <td className="px-3 py-2 text-right">{formatKRW(totals.crmGrandTotal)}</td>
        <td className="px-3 py-2 text-right">{formatKRW(totals.terminalGrandTotal)}</td>
        <td className="px-3 py-2 text-center">
          {totals.isMatched ? (
            <span className="text-emerald-600">✓</span>
          ) : (
            <span className="text-rose-600">✗</span>
          )}
        </td>
        <td className="px-3 py-2 text-neutral-500 text-xs">
          {new Date(r.submittedAt).toLocaleString("ko-KR")}
        </td>
        <td className="px-3 py-2 text-right">
          <button onClick={onToggle} className="text-xs text-brand-600 hover:underline">
            {isOpen ? "닫기" : "상세"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-neutral-50">
          <td colSpan={6} className="px-4 py-4">
            <Detail r={r} />
          </td>
        </tr>
      )}
    </>
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
