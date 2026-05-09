import { NextResponse } from "next/server";
import { Resend } from "resend";
import { kv } from "@vercel/kv";
import { computeTotals, SalesReport } from "@/lib/types";
import { buildEmailHTML } from "@/lib/email-template";

export const runtime = "nodejs";

interface SubmitBody {
  reportDate: string;
  author: string;
  reviewer?: string;
  crmTaxableCard: number;
  crmTaxableCashReceipt: number;
  crmTaxableTransfer: number;
  crmTaxFreeCard: number;
  terminals: Array<{ name: string; card: number; cash: number }>;
  cashOnHand: number;
  notes?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;

    if (!body.author || !body.author.trim()) {
      return NextResponse.json({ error: "작성자 이름이 필요합니다." }, { status: 400 });
    }
    if (!body.reportDate) {
      return NextResponse.json({ error: "작성일자가 필요합니다." }, { status: 400 });
    }
    if (!Array.isArray(body.terminals)) {
      return NextResponse.json({ error: "단말기 데이터가 잘못되었습니다." }, { status: 400 });
    }

    // SERVER-SIDE matching validation - block if not matched
    const totals = computeTotals(body);
    if (!totals.isMatched) {
      return NextResponse.json(
        {
          error: "CRM 합계와 단말기 합계가 일치하지 않아 제출할 수 없습니다.",
          totals,
        },
        { status: 400 }
      );
    }

    const id = `${body.reportDate}_${Date.now()}`;
    const report: SalesReport = {
      id,
      reportDate: body.reportDate,
      author: body.author.trim(),
      reviewer: body.reviewer?.trim() || undefined,
      crmTaxableCard: Number(body.crmTaxableCard) || 0,
      crmTaxableCashReceipt: Number(body.crmTaxableCashReceipt) || 0,
      crmTaxableTransfer: Number(body.crmTaxableTransfer) || 0,
      crmTaxFreeCard: Number(body.crmTaxFreeCard) || 0,
      terminals: body.terminals.map((t) => ({
        name: String(t.name || ""),
        card: Number(t.card) || 0,
        cash: Number(t.cash) || 0,
      })),
      cashOnHand: Number(body.cashOnHand) || 0,
      notes: body.notes?.toString(),
      submittedAt: new Date().toISOString(),
    };

    // 1) Save to Vercel KV (best-effort - don't block submission if KV not configured)
    try {
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        await kv.set(`report:${id}`, report);
        await kv.zadd("reports:index", {
          score: Date.parse(report.submittedAt),
          member: id,
        });
      }
    } catch (kvErr) {
      console.error("KV save failed:", kvErr);
    }

    // 2) Send email via Resend
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.EMAIL_TO || "jiscompanylimited@gmail.com";
    const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

    if (!apiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY 환경 변수가 설정되어 있지 않습니다.", saved: true, id },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const subject = `[뷰티파크의원 매출] ${report.reportDate} - ${report.author}`;
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html: buildEmailHTML(report),
    });

    if (error) {
      return NextResponse.json(
        { error: `이메일 발송 실패: ${error.message}`, saved: true, id },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id, totals });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
