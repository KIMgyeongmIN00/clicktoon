import type { SupabaseClient } from "@supabase/supabase-js";
import { Character } from "@/types/character";

/**
 * 캐릭터들을 **요청한 id 순서 그대로** 읽어 온다.
 *
 * Supabase의 .in()은 결과 순서를 보장하지 않는다. 이 순서가 곧 프롬프트의
 * [IMAGE 1..N] 번호이자 어댑터가 이미지를 싣는 순서라, 어긋나면 캐릭터가
 * 통째로 뒤바뀐 그림이 나온다. 반드시 재정렬할 것.
 */
export async function loadCharactersOrdered(
  sb: SupabaseClient,
  ids: string[],
): Promise<Character[]> {
  const res = await sb.from("characters").select("*").in("id", ids);
  if (res.error) throw res.error;
  const byId = new Map(
    (res.data ?? []).map((c) => [c.id as string, c as Character]),
  );
  return ids.map((id) => {
    const c = byId.get(id);
    if (!c) throw new Error(`character not found: ${id}`);
    return c;
  });
}
