"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";
import { CharacterWithUrls } from "@/types/character";
import { browserSupabase } from "@/lib/supabase/browser";
import {
  listLocalCharacters,
  deleteLocalCharacter,
  type LocalCharacter,
} from "@/lib/local/characters";

export default function CharactersPage() {
  const [items, setItems] = useState<CharacterWithUrls[] | null>(null);
  const [locals, setLocals] = useState<LocalCharacter[] | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await browserSupabase().auth.getUser();
      const isAuthed = !!data.user;
      setAuthed(isAuthed);
      if (!isAuthed) {
        // 미로그인: 브라우저에 보관된 로컬 캐릭터
        setLocals(await listLocalCharacters().catch(() => []));
        setItems([]);
        return;
      }
      try {
        const r = await fetch("/api/characters");
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "load failed");
        setItems(json.items);
      } catch (e) {
        toast.error(`불러오기 실패: ${(e as Error).message}`);
        setItems([]);
      }
    })();
  }, []);

  async function removeLocal(id: string) {
    await deleteLocalCharacter(id);
    setLocals((cur) => (cur ?? []).filter((c) => c.id !== id));
  }

  const loading = items === null || (authed === false && locals === null);
  const isEmpty =
    !loading && (items?.length ?? 0) === 0 && (locals?.length ?? 0) === 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">캐릭터 보관함</h1>
        <Link href="/characters/new">
          <Button>
            <Plus />새 캐릭터
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isEmpty && (
        <div className="rounded-lg border border-dashed border-[var(--border)] py-20 text-center text-sm text-[var(--muted)]">
          아직 캐릭터가 없습니다. 새 캐릭터를 추가해보세요.
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {(items ?? []).map((c) => (
            <CharacterCard key={c.id} c={c} />
          ))}
          {(locals ?? []).map((c) => {
            const prim = c.images.front ?? c.images.side ?? c.images.back;
            const url = prim ? URL.createObjectURL(prim) : "";
            return (
              <div key={c.id} className="group relative">
                {/* 서버 캐릭터 카드(CharacterCard)와 동일한 모양 */}
                <Link
                  href={`/?character=${encodeURIComponent(c.id)}`}
                  className="block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent)]"
                >
                  <div className="relative aspect-square w-full bg-[var(--surface-2)]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={c.name}
                        className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">
                      {c.meta?.mainConcept || "—"}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  title="삭제"
                  onClick={() => removeLocal(c.id)}
                  className="absolute right-2 top-2 hidden rounded bg-black/60 p-1 text-white group-hover:block"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
