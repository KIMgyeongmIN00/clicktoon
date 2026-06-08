"use client";
import Link from "next/link";
import { CharacterWithUrls } from "@/types/character";

export function CharacterPicker({
  characters,
  selectedId,
  onSelect,
  loading,
}: {
  characters: CharacterWithUrls[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          캐릭터 선택
        </div>
        <Link
          href="/characters/new"
          className="text-[10px] text-[var(--accent)] hover:underline"
        >
          + 새 캐릭터
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-[var(--surface-2)]"
            />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border)] p-3 text-xs text-[var(--muted)]">
          등록된 캐릭터가 없습니다.{" "}
          <Link href="/characters/new" className="text-[var(--accent)]">
            추가하기
          </Link>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {characters.map((c) => {
            const active = c.id === selectedId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                title={c.name}
                className={[
                  "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition",
                  active
                    ? "border-[var(--accent)]"
                    : "border-transparent hover:border-[var(--border)]",
                ].join(" ")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.thumb_url ?? c.ref_url}
                  alt={c.name}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
