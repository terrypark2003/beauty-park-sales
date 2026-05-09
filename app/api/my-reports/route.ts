// 작성자 이름을 받아 KV에서 해당 작성자의 보고서 목록을 반환하는 API 라우트
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { SalesReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const author = (url.searchParams.get("author") || "").trim();

  if (!author) {
    return NextResponse.json({ error: "작성자 이름이 필요합니다." }, { status: 400 });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json(
      { error: "저장소가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    const indexKey = `reports:author:${author.toLowerCase()}`;
    const ids = (await kv.zrange(indexKey, 0, 199, { rev: true })) as string[];

    if (!ids || ids.length === 0) {
      return NextResponse.json({ reports: [] });
    }

    const reports = await Promise.all(
      ids.map((id) => kv.get<SalesReport>(`report:${id}`))
    );

    // Defensive filter: ensure author still matches (case-insensitive)
    const filtered = (reports.filter(Boolean) as SalesReport[]).filter(
      (r) => r.author.trim().toLowerCase() === author.toLowerCase()
    );

    return NextResponse.json({ reports: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
