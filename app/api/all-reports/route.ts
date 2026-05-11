// 직원 진입 비밀번호 또는 관리자 비밀번호로 전체 보고서 목록을 반환하는 API 라우트
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { SalesReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTRY_PASSWORD = "bpdeskteam";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const password = url.searchParams.get("password") || "";
  const admin = process.env.ADMIN_PASSWORD || "";

  if (password !== ENTRY_PASSWORD && (!admin || password !== admin)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json(
      { error: "저장소가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
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
