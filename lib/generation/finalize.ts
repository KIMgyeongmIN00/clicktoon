import { serverSupabase } from "@/lib/supabase/server";

// 생성 row 상태 전이. 모든 전이는 멱등(비종료 상태에서만 진행)이라 중복
// 처리/콜백에도 안전하다. Phase C에서 markDone/markFailed에 크레딧 확정/환불을 붙인다.

const now = () => new Date().toISOString();

// queued → processing. 이미 누군가 가져갔으면 false(중복 처리 방지).
export async function markProcessing(generationId: string): Promise<boolean> {
  const sb = serverSupabase();
  const { data, error } = await sb
    .from("generations")
    .update({ status: "processing", updated_at: now() })
    .eq("id", generationId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markDone(
  generationId: string,
  out: { resultPath: string; model: string; prompt: string },
): Promise<void> {
  const sb = serverSupabase();
  const { error } = await sb
    .from("generations")
    .update({
      status: "done",
      result_path: out.resultPath,
      model: out.model,
      prompt: out.prompt,
      error_message: null,
      updated_at: now(),
    })
    .eq("id", generationId)
    .in("status", ["queued", "processing"]); // 종료 상태면 무시(멱등)
  if (error) throw error;
}

export async function markFailed(
  generationId: string,
  message: string,
): Promise<void> {
  const sb = serverSupabase();
  const { error } = await sb
    .from("generations")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      updated_at: now(),
    })
    .eq("id", generationId)
    .in("status", ["queued", "processing"]);
  if (error) throw error;
}
