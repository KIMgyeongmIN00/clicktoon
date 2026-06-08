"use client";
import { useState } from "react";
import { CharacterMeta } from "@/types/character";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type CharacterFormValue = {
  name: string;
  meta: CharacterMeta;
};

const GENDERS = ["male", "female", "nonbinary", "other"] as const;
const BUILDS = ["slim", "athletic", "muscular", "plump", "custom"] as const;

export function CharacterFormFields({
  value,
  onChange,
}: {
  value: CharacterFormValue;
  onChange: (next: CharacterFormValue) => void;
}) {
  const [tagDraft, setTagDraft] = useState("");

  function set<K extends keyof CharacterFormValue>(
    k: K,
    v: CharacterFormValue[K],
  ) {
    onChange({ ...value, [k]: v });
  }
  function setMeta<K extends keyof CharacterMeta>(k: K, v: CharacterMeta[K]) {
    onChange({ ...value, meta: { ...value.meta, [k]: v } });
  }
  function setProportion<K extends keyof CharacterMeta["proportions"]>(
    k: K,
    v: CharacterMeta["proportions"][K],
  ) {
    onChange({
      ...value,
      meta: {
        ...value.meta,
        proportions: { ...value.meta.proportions, [k]: v },
      },
    });
  }

  function addTag() {
    const t = tagDraft.trim();
    if (!t) return;
    if ((value.meta.tags ?? []).includes(t)) return;
    setMeta("tags", [...(value.meta.tags ?? []), t]);
    setTagDraft("");
  }

  function removeTag(t: string) {
    setMeta(
      "tags",
      (value.meta.tags ?? []).filter((x) => x !== t),
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <Label>이름</Label>
        <Input
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="캐릭터 이름"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label>메인 컨셉</Label>
        <Input
          value={value.meta.mainConcept ?? ""}
          onChange={(e) => setMeta("mainConcept", e.target.value)}
          placeholder="예: 사이버펑크 전사, 학생, 마법사 등"
        />
      </div>

      <div className="space-y-1.5">
        <Label>성별</Label>
        <select
          value={value.meta.gender ?? ""}
          onChange={(e) =>
            setMeta("gender", (e.target.value || undefined) as CharacterMeta["gender"])
          }
          className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        >
          <option value="">선택 안 함</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>비율 (n등신)</Label>
        <Input
          type="number"
          min={2}
          max={12}
          step={0.5}
          value={value.meta.proportions?.heads ?? ""}
          onChange={(e) =>
            setProportion(
              "heads",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label>체형</Label>
        <select
          value={value.meta.proportions?.build ?? ""}
          onChange={(e) =>
            setProportion(
              "build",
              (e.target.value || undefined) as CharacterMeta["proportions"]["build"],
            )
          }
          className="flex h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
        >
          <option value="">선택 안 함</option>
          {BUILDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>체형 메모</Label>
        <Input
          value={value.meta.proportions?.buildNotes ?? ""}
          onChange={(e) => setProportion("buildNotes", e.target.value)}
          placeholder="자유롭게"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label>스타일 노트</Label>
        <Textarea
          value={value.meta.styleNotes ?? ""}
          onChange={(e) => setMeta("styleNotes", e.target.value)}
          rows={3}
          placeholder="아트 스타일, 색감, 분위기 등"
        />
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label>태그</Label>
        <div className="flex gap-2">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="엔터로 추가"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(value.meta.tags ?? []).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => removeTag(t)}
              className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs text-[var(--foreground)] hover:bg-[var(--danger)]/30"
            >
              {t} ×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
