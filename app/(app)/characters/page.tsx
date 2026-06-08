"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "@/components/characters/character-card";
import { CharacterWithUrls } from "@/types/character";

export default function CharactersPage() {
  const [items, setItems] = useState<CharacterWithUrls[] | null>(null);

  useEffect(() => {
    (async () => {
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

      {items === null && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] py-20 text-center text-sm text-[var(--muted)]">
          아직 캐릭터가 없습니다. 새 캐릭터를 추가해보세요.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((c) => (
            <CharacterCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </main>
  );
}
