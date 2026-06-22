import { NextResponse } from "next/server";
import {
  RESULT_BUCKET,
  serverSupabase,
  signedUrl,
} from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 본인의 완료된 생성물 갤러리, 최신순 (서명 URL + 캐릭터명).
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const sb = serverSupabase();
    const gens = await sb
      .from("generations")
      .select("*")
      .eq("owner", user.id)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(500);
    if (gens.error) throw gens.error;

    const charIds = Array.from(
      new Set((gens.data ?? []).map((g) => g.character_id)),
    );
    const names = new Map<string, string>();
    if (charIds.length) {
      const chars = await sb
        .from("characters")
        .select("id,name")
        .in("id", charIds);
      if (chars.error) throw chars.error;
      for (const c of chars.data ?? []) names.set(c.id, c.name);
    }

    const items = await Promise.all(
      (gens.data ?? []).map(async (g) => ({
        ...g,
        result_url: await signedUrl(RESULT_BUCKET, g.result_path),
        character_name: names.get(g.character_id) ?? "(삭제됨)",
      })),
    );

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }
}
