"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PROVIDER_LABELS, Provider } from "@/lib/providers/types";

const providerLabel = (p: string) => PROVIDER_LABELS[p as Provider] ?? p;

type GalleryItem = {
  id: string;
  character_id: string;
  character_name: string;
  provider: string;
  model: string;
  created_at: string;
  result_url: string;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [zoom, setZoom] = useState<GalleryItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/generations");
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
      <h1 className="mb-6 text-xl font-semibold">전체 생성 갤러리</h1>

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
          아직 생성된 이미지가 없습니다.{" "}
          <Link href="/" className="text-[var(--accent)]">
            포즈 생성하러 가기
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setZoom(g)}
              className="group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-left transition hover:border-[var(--accent)]"
            >
              <div className="aspect-square w-full bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.result_url}
                  alt={g.character_name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="truncate">{g.character_name}</span>
                <span className="text-[var(--muted)]">
                  {providerLabel(g.provider)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setZoom(null)}
        >
          <div
            className="flex max-h-full max-w-3xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoom.result_url}
              alt={zoom.character_name}
              className="max-h-[80vh] rounded-lg object-contain"
            />
            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <span>
                {zoom.character_name} · {providerLabel(zoom.provider)} (
                {zoom.model})
              </span>
              <Link
                href={`/characters/${zoom.character_id}`}
                className="text-[var(--accent)] hover:underline"
              >
                캐릭터 보기 →
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
