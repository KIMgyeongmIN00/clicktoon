import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/crypto/hmac";
import { markDone, markFailed } from "@/lib/generation/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 워커(Trigger.dev task)가 생성 완료/실패를 알리는 콜백. Next가 유일한 DB 작성자이므로
// 여기서만 row를 done/failed로 전이한다. (SDD §7 / D2-B)
//   헤더: X-Signature(HMAC-SHA256 over `${ts}.${body}`), X-Worker-Role, X-Timestamp
//   본문: { status: "done", result_path, model, prompt } | { status: "failed", error }
const ALLOWED_ROLES = new Set(["worker"]);
const MAX_SKEW_MS = 5 * 60 * 1000;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const secret = process.env.WORKER_CALLBACK_SECRET;
    if (!secret)
      return NextResponse.json(
        { error: "WORKER_CALLBACK_SECRET가 설정되지 않았습니다." },
        { status: 500 },
      );

    const { id } = await ctx.params;
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const role = req.headers.get("x-worker-role") ?? "";
    const ts = req.headers.get("x-timestamp") ?? "";

    // ① role
    if (!ALLOWED_ROLES.has(role))
      return NextResponse.json({ error: "forbidden role" }, { status: 403 });
    // ② timestamp 허용 윈도우 (재생공격 방지)
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_SKEW_MS)
      return NextResponse.json(
        { error: "stale or invalid timestamp" },
        { status: 401 },
      );
    // ③ HMAC 서명 (generationId를 서명에 바인딩 — 다른 row로의 재사용 차단)
    if (!verifySignature(secret, ts, rawBody, signature, id))
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });

    const body = JSON.parse(rawBody || "{}");
    if (body.status === "done") {
      if (!body.result_path || !body.model)
        return NextResponse.json(
          { error: "result_path, model required" },
          { status: 400 },
        );
      await markDone(id, {
        resultPath: String(body.result_path),
        model: String(body.model),
        prompt: typeof body.prompt === "string" ? body.prompt : "",
      });
    } else if (body.status === "failed") {
      await markFailed(id, String(body.error ?? "worker reported failure"));
    } else {
      return NextResponse.json({ error: "unknown status" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[generations callback]", e);
    return NextResponse.json(
      { error: "내부 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
