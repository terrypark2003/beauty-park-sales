// 작성자명 기준으로 매출 보고서 임시저장을 KV에 보관·조회·삭제하는 API 라우트
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENTRY_PASSWORD = "bpdeskteam";

function authOk(pw: string | null): boolean {
  const admin = process.env.ADMIN_PASSWORD || "";
  return pw === ENTRY_PASSWORD || (Boolean(admin) && pw === admin);
}

function draftKey(author: string): string {
  return `draft:author:${author.trim().toLowerCase()}`;
}

function checkKv(): NextResponse | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "저장소 미설정" }, { status: 500 });
  }
  return null;
}

// GET: 작성자명으로 임시저장 조회
export async function GET(req: Request) {
  const kvErr = checkKv();
  if (kvErr) return kvErr;
  const url = new URL(req.url);
  const password = url.searchParams.get("password");
  const author = (url.searchParams.get("author") || "").trim();

  if (!authOk(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (!author) {
    return NextResponse.json({ error: "작성자명이 필요합니다." }, { status: 400 });
  }

  try {
    const draft = await kv.get(draftKey(author));
    return NextResponse.json({ draft: draft || null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "조회 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface SaveBody {
  password: string;
  author: string;
  data: Record<string, unknown>;
}

// POST: 임시저장
export async function POST(req: Request) {
  const kvErr = checkKv();
  if (kvErr) return kvErr;
  try {
    const body = (await req.json()) as SaveBody;
    if (!authOk(body.password)) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }
    const author = (body.author || "").trim();
    if (!author) {
      return NextResponse.json({ error: "작성자명이 필요합니다." }, { status: 400 });
    }
    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "data가 필요합니다." }, { status: 400 });
    }

    const payload = {
      ...body.data,
      author,
      savedAt: new Date().toISOString(),
    };
    await kv.set(draftKey(author), payload);
    return NextResponse.json({ ok: true, savedAt: payload.savedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "저장 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: 임시저장 삭제
export async function DELETE(req: Request) {
  const kvErr = checkKv();
  if (kvErr) return kvErr;
  const url = new URL(req.url);
  const password = url.searchParams.get("password");
  const author = (url.searchParams.get("author") || "").trim();

  if (!authOk(password)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (!author) {
    return NextResponse.json({ error: "작성자명이 필요합니다." }, { status: 400 });
  }

  try {
    await kv.del(draftKey(author));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
