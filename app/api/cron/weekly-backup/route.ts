// 매주 토요일 KST 18시(UTC 09:00 Sat)에 KV 전체 보고서를 CSV·JSON 첨부 메일로 백업하는 Vercel Cron 라우트
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { kv } from "@vercel/kv";
import { computeTotals, SalesReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DeletedSalesReport extends SalesReport {
  deletedAt?: string;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function reportsToCSV(rows: Array<SalesReport | DeletedSalesReport>): string {
  const header = [
    "구분",
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
    "삭제시각",
  ];
  const lines = rows.map((r) => {
    const t = computeTotals(r);
    const isDeleted = "deletedAt" in r && r.deletedAt;
    return [
      isDeleted ? "삭제" : "활성",
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
      r.transferDetails || "",
      r.notes || "",
      r.crmConfirmed ? "Y" : "",
      r.terminalConfirmed ? "Y" : "",
      r.salesConfirmed ? "Y" : "",
      r.confirmedAt || "",
      r.lastEditedAt || "",
      r.submittedAt,
      isDeleted ? (r as DeletedSalesReport).deletedAt : "",
    ]
      .map(csvEscape)
      .join(",");
  });
  // UTF-8 BOM for Excel Korean compatibility
  return "﻿" + [header.join(","), ...lines].join("\n");
}

export async function GET(req: Request) {
  // Authorization check — Vercel cron adds Bearer token, manual hits must provide too
  const expected = process.env.CRON_SECRET || "";
  const authHeader = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") || "";

  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET 미설정" }, { status: 500 });
  }
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : querySecret;
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "저장소 미설정" }, { status: 500 });
  }

  try {
    // Collect active reports
    const activeIds = ((await kv.zrange("reports:index", 0, 4999, { rev: true })) as string[]) || [];
    const active = await Promise.all(
      activeIds.map((id) => kv.get<SalesReport>(`report:${id}`))
    );

    // Collect deleted reports via SCAN
    let cursor: string | number = 0;
    const deletedKeys: string[] = [];
    do {
      const res = (await kv.scan(cursor, { match: "deleted:report:*", count: 200 })) as unknown as [
        string | number,
        string[]
      ];
      cursor = res[0];
      deletedKeys.push(...res[1]);
    } while (cursor !== 0 && cursor !== "0");
    const deleted = await Promise.all(
      deletedKeys.map((k) => kv.get<DeletedSalesReport>(k))
    );

    const activeRows = (active.filter(Boolean) as SalesReport[]);
    const deletedRows = (deleted.filter(Boolean) as DeletedSalesReport[]);

    const allRows: Array<SalesReport | DeletedSalesReport> = [...activeRows, ...deletedRows];

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    const kstLabel = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);

    const csv = reportsToCSV(allRows);
    const json = JSON.stringify({ exportedAt: now.toISOString(), active: activeRows, deleted: deletedRows }, null, 2);

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const to = process.env.EMAIL_TO || "jiscompanylimited@gmail.com";
    const fromName = process.env.EMAIL_FROM_NAME || "뷰티파크의원 매출 보고";

    if (!gmailUser || !gmailPass) {
      return NextResponse.json(
        { error: "GMAIL 환경 변수 미설정", csvSize: csv.length, jsonSize: json.length },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${gmailUser}>`,
      to,
      subject: `[뷰티파크의원 매출 백업] ${stamp} - 활성 ${activeRows.length}건, 삭제 ${deletedRows.length}건`,
      text: [
        "안녕하세요, 뷰티파크의원 매출 보고 시스템의 주간 자동 백업입니다.",
        "",
        `백업 시각 (KST): ${kstLabel}`,
        `활성 보고서: ${activeRows.length}건`,
        `소프트 삭제된 보고서: ${deletedRows.length}건`,
        "",
        "첨부 파일:",
        `- backup-${stamp}.csv (엑셀에서 바로 열기, 활성+삭제 통합)`,
        `- backup-${stamp}.json (전체 원본 데이터, 복원용)`,
        "",
        "이 이메일을 안전한 곳에 보관해주세요. 자동 발송이라 회신은 받지 않습니다.",
      ].join("\n"),
      attachments: [
        {
          filename: `backup-${stamp}.csv`,
          content: csv,
          contentType: "text/csv; charset=utf-8",
        },
        {
          filename: `backup-${stamp}.json`,
          content: json,
          contentType: "application/json; charset=utf-8",
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      active: activeRows.length,
      deleted: deletedRows.length,
      sentTo: to,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "백업 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
