import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { SalesReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const password = url.searchParams.get("password") || "";
  const expected = process.env.ADMIN_PASSWORD || "";

  if (!expected) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  if (password !== expected) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({
      error: "Vercel KV가 설정되어 있지 않습니다. Vercel 프로젝트의 Storage에서 KV를 연결하세요.",
    }, { status: 500 });
  }

  try {
    // Most recent first, up to 500
    const ids = (await kv.zrange("reports:index", 0, 499, { rev: true })) as string[];
    if (!ids || ids.length === 0) {
      return NextResponse.json({ reports: [] });
    }
    const reports = await Promise.all(
      ids.map((id) => kv.get<SalesReport>(`report:${id}`))
    );
    return NextResponse.json({
      reports: reports.filter(Boolean) as SalesReport[],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
