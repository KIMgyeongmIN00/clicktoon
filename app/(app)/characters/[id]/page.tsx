"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Edit3, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CharacterFormFields,
  CharacterFormValue,
} from "@/components/characters/character-form";
import { CharacterWithUrls, GenerationWithUrl } from "@/types/character";

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterWithUrls | null>(null);
  const [generations, setGenerations] = useState<GenerationWithUrl[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterFormValue | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/characters/${id}`);
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "load failed");
        setCharacter(json.character);
        setGenerations(json.generations ?? []);
      } catch (e) {
        toast.error(`불러오기 실패: ${(e as Error).message}`);
      }
    })();
  }, [id]);

  function startEdit() {
    if (!character) return;
    setDraft({ name: character.name, meta: character.meta });
    setEditing(true);
  }

  async function saveEdit() {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, meta: draft.meta }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "save failed");
      toast.success("저장 완료");
      setCharacter((c) =>
        c ? { ...c, name: draft.name, meta: draft.meta } : c,
      );
      setEditing(false);
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("삭제할까요? 결과 갤러리도 함께 삭제됩니다.")) return;
    try {
      const r = await fetch(`/api/characters/${id}`, { method: "DELETE" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "delete failed");
      toast.success("삭제 완료");
      router.replace("/characters");
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`);
    }
  }

  if (!character) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="animate-pulse text-sm text-[var(--muted)]">불러오는 중…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{character.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {character.meta.mainConcept}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/?character=${character.id}`}>
            <Button>
              <Wand2 /> 포즈 생성
            </Button>
          </Link>
          <Button variant="outline" onClick={startEdit}>
            <Edit3 /> 편집
          </Button>
          <Button variant="danger" onClick={remove}>
            <Trash2 /> 삭제
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={character.ref_url}
            alt={character.name}
            className="block max-h-[70vh] w-full object-contain"
          />
        </div>
        <div className="space-y-4">
          {!editing && (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="성별" value={character.meta.gender ?? "—"} />
              <Meta
                label="비율"
                value={
                  character.meta.proportions?.heads
                    ? `${character.meta.proportions.heads}등신`
                    : "—"
                }
              />
              <Meta
                label="체형"
                value={character.meta.proportions?.build ?? "—"}
              />
              <Meta
                label="체형 메모"
                value={character.meta.proportions?.buildNotes ?? "—"}
              />
              <Meta
                className="col-span-2"
                label="스타일 노트"
                value={character.meta.styleNotes ?? "—"}
              />
              <Meta
                className="col-span-2"
                label="태그"
                value={
                  (character.meta.tags ?? []).join(", ") || "—"
                }
              />
            </dl>
          )}
          {editing && draft && (
            <div className="space-y-4">
              <CharacterFormFields value={draft} onChange={setDraft} />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
          생성 갤러리
        </h2>
        {generations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] py-12 text-center text-sm text-[var(--muted)]">
            아직 생성된 이미지가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {generations.map((g) => (
              <div
                key={g.id}
                className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.result_url}
                  alt="generation"
                  className="block aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between px-3 py-2 text-xs text-[var(--muted)]">
                  <span>{g.provider}</span>
                  <span>{new Date(g.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Meta({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
