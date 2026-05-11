// 관리자 비밀번호로 보호되는 보고서 편집(PATCH) · 소프트 삭제(DELETE) API 라우트
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { computeTotals, isFullyConfirmed, SalesReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkPassword(password: string | null): { ok: boolean; error?: NextResponse } {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) {
    return {
      ok: false,
      error: NextResponse.json({ error: "ADMIN_PASSWORD 미설정" }, { status: 500 }),
    };
  }
  if (password !== expected) {
    return {
      ok: false,
      error: NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 }),
    };
  }
  return { ok: true };
}

function checkKv(): NextResponse | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "저장소 미설정" }, { status: 500 });
  }
  return null;
}

interface MutationBody {
  password: string;
  id: string;
  // Edit-mode patch (any of these fields)
  patch?: Partial<Pick<
    SalesReport,
    | "reportDate"
    | "reviewer"
    | "crmTaxableCard"
    | "crmTaxableCashReceipt"
    | "crmTaxableTransfer"
    | "crmTaxFreeCard"
    | "crmTaxFreeCashReceipt"
    | "crmTaxFreeTransfer"
    | "terminals"
    | "cashOnHand"
    | "transferDetails"
    | "notes"
    | "crmConfirmed"
    | "terminalConfirmed"
    | "salesConfirmed"
  >>;
}

// PATCH: update specific fields of a report (edit + checkboxes)
export async function PATCH(req: Request) {
  const kvErr = checkKv();
  if (kvErr) return kvErr;
  try {
    const body = (await req.json()) as MutationBody;
    const auth = checkPassword(body.password);
    if (!auth.ok) return auth.error!;

    if (!body.id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

    const existing = await kv.get<SalesReport>(`report:${body.id}`);
    if (!existing) return NextResponse.json({ error: "보고서 없음" }, { status: 404 });

    const patch = body.patch || {};
    const updated: SalesReport = { ...existing, ...patch };

    // Recompute author-specific check is unchanged; do not allow changing author
    updated.author = existing.author;
    updated.id = existing.id;
    updated.submittedAt = existing.submittedAt;

    const wasFullyConfirmed = isFullyConfirmed(existing);
    const nowFullyConfirmed = isFullyConfirmed(updated);

    if (!wasFullyConfirmed && nowFullyConfirmed) {
      updated.confirmedAt = new Date().toISOString();
    } else if (wasFullyConfirmed && !nowFullyConfirmed) {
      updated.confirmedAt = undefined;
    }

    // Track edit timestamp when payload contains non-confirmation fields
    const editKeys: Array<keyof typeof patch> = [
      "reportDate",
      "reviewer",
      "crmTaxableCard",
      "crmTaxableCashReceipt",
      "crmTaxableTransfer",
      "crmTaxFreeCard",
      "crmTaxFreeCashReceipt",
      "crmTaxFreeTransfer",
      "terminals",
      "cashOnHand",
      "transferDetails",
      "notes",
    ];
    const editedField = editKeys.some((k) => Object.prototype.hasOwnProperty.call(patch, k));
    if (editedField) {
      updated.lastEditedAt = new Date().toISOString();
    }

    await kv.set(`report:${updated.id}`, updated);
    return NextResponse.json({ ok: true, report: updated, totals: computeTotals(updated) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "수정 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE: soft-delete (move to deleted set, remove from main indexes)
export async function DELETE(req: Request) {
  const kvErr = checkKv();
  if (kvErr) return kvErr;
  try {
    const url = new URL(req.url);
    const password = url.searchParams.get("password");
    const id = url.searchParams.get("id");
    const auth = checkPassword(password);
    if (!auth.ok) return auth.error!;

    if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

    const existing = await kv.get<SalesReport>(`report:${id}`);
    if (!existing) return NextResponse.json({ error: "보고서 없음" }, { status: 404 });

    // Soft delete: move data to a deleted store, remove from main indexes.
    await kv.set(`deleted:report:${id}`, {
      ...existing,
      deletedAt: new Date().toISOString(),
    });
    await kv.zrem("reports:index", id);
    if (existing.author) {
      await kv.zrem(`reports:author:${existing.author.trim().toLowerCase()}`, id);
    }
    await kv.del(`report:${id}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "삭제 실패";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
