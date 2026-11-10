"use client";
import {
  listLocalCharacters,
  deleteLocalCharacter,
  primaryImage,
} from "./characters";
import { makeThumbnail, compressForUpload, readJsonOrThrow } from "@/lib/image/thumbnail";

// 로그인 직후 로컬(IndexedDB) 캐릭터들을 서버로 업로드하고 로컬본을 지운다.
// 반환: localId → 서버 characterId 매핑 (pending 생성 재개에 사용).
let inflight: Promise<Map<string, string>> | null = null;

export function syncLocalCharactersToServer(): Promise<Map<string, string>> {
  if (inflight) return inflight;
  inflight = (async () => {
    const mapping = new Map<string, string>();
    const locals = await listLocalCharacters();
    for (const c of locals) {
      try {
        const form = new FormData();
        const f = (b: Blob, n: string) =>
          compressForUpload(new File([b], n, { type: b.type || "image/png" }));
        if (c.images.front) form.set("front", await f(c.images.front, "front.png"));
        if (c.images.side) form.set("side", await f(c.images.side, "side.png"));
        if (c.images.back) form.set("back", await f(c.images.back, "back.png"));
        for (const ex of c.images.extras) form.append("extra", await f(ex, "extra.png"));
        const prim = primaryImage(c);
        if (prim) {
          const thumb = await makeThumbnail(
            new File([prim], "primary.png", { type: prim.type || "image/png" }),
          ).catch(() => null);
          if (thumb) form.set("thumb", thumb);
        }
        form.set("name", c.name);
        form.set("meta", JSON.stringify(c.meta));
        const r = await fetch("/api/characters", { method: "POST", body: form });
        const json = await readJsonOrThrow(r);
        if (!r.ok) throw new Error(json.error ?? "sync failed");
        mapping.set(c.id, json.character.id);
        await deleteLocalCharacter(c.id);
      } catch (e) {
        console.error("[local sync]", c.id, e);
        // 실패한 캐릭터는 로컬에 남겨두고 계속 진행
      }
    }
    return mapping;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
