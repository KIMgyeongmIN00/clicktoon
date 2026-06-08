import Link from "next/link";
import { CharacterWithUrls } from "@/types/character";

export function CharacterCard({ c }: { c: CharacterWithUrls }) {
  const img = c.thumb_url ?? c.ref_url;
  return (
    <Link
      href={`/characters/${c.id}`}
      className="group block overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent)]"
    >
      <div className="relative aspect-square w-full bg-[var(--surface-2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={c.name}
          className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="space-y-1 p-3">
        <div className="truncate text-sm font-medium">{c.name}</div>
        <div className="truncate text-xs text-[var(--muted)]">
          {c.meta?.mainConcept || "—"}
        </div>
      </div>
    </Link>
  );
}
