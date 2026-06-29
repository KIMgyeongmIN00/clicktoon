"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CharacterFormFields,
  CharacterFormValue,
} from "@/components/characters/character-form";
import { ImageDrop } from "@/components/characters/image-drop";
import { makeThumbnail } from "@/lib/image/thumbnail";

const INITIAL: CharacterFormValue = {
  name: "",
  meta: { mainConcept: "", proportions: {}, tags: [] },
};
const STEPS = ["시점 이미지", "컨셉 설명", "추가 자료"];

export default function NewCharacterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [front, setFront] = useState<File | null>(null);
  const [side, setSide] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [extras, setExtras] = useState<File[]>([]);
  const [value, setValue] = useState<CharacterFormValue>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const viewSlots: {
    label: string;
    file: File | null;
    set: (f: File | null) => void;
  }[] = [
    { label: "정면", file: front, set: setFront },
    { label: "옆면", file: side, set: setSide },
    { label: "뒷면", file: back, set: setBack },
  ];
  const hasView = !!(front || side || back);
  const basicsOk = !!value.name.trim() && !!value.meta.mainConcept.trim();

  function next() {
    if (step === 0 && !hasView) {
      toast.error("최소 한 장의 캐릭터 이미지를 올려주세요");
      return;
    }
    if (step === 1 && !basicsOk) {
      toast.error("이름과 메인 컨셉은 필수입니다");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function addExtras(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setExtras((cur) => [...cur, ...imgs].slice(0, 10));
  }

  async function submit() {
    if (!hasView) {
      toast.error("최소 한 장의 이미지가 필요합니다");
      setStep(0);
      return;
    }
    if (!basicsOk) {
      toast.error("이름과 메인 컨셉은 필수입니다");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const primary = (front ?? side ?? back)!;
      const thumb = await makeThumbnail(primary).catch(() => null);
      const form = new FormData();
      if (front) form.set("front", front);
      if (side) form.set("side", side);
      if (back) form.set("back", back);
      for (const ex of extras) form.append("extra", ex);
      if (thumb) form.set("thumb", thumb);
      form.set("name", value.name);
      form.set("meta", JSON.stringify(value.meta));
      const r = await fetch("/api/characters", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "업로드 실패");
      toast.success("캐릭터 추가 완료");
      router.replace(`/characters/${json.character.id}`);
    } catch (e) {
      toast.error(`업로드 실패: ${(e as Error).message}`);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-5 text-xl font-semibold">새 캐릭터</h1>

      {/* 스텝 인디케이터 */}
      <div className="mb-6 flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                i === step
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                  : i < step
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--muted)]",
              ].join(" ")}
            >
              {i + 1}
            </span>
            <span
              className={
                i === step
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted)]"
              }
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-6 bg-[var(--border)]" />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[320px]">
        {/* STEP 1 — 시점 이미지 */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              캐릭터의 시점별 이미지를 올려주세요. (최소 1장, 정면 권장)
            </p>
            <div className="grid grid-cols-3 gap-4">
              {viewSlots.map((v) => (
                <div key={v.label} className="space-y-1.5">
                  <div className="text-xs font-medium">{v.label}</div>
                  <ImageDrop value={v.file} onChange={v.set} />
                </div>
              ))}
            </div>
            <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
              💡 이미지 한 장만 있나요? 곧 단일 이미지로 AI 컨셉아트를 생성하는
              플로우가 추가됩니다.
            </p>
          </div>
        )}

        {/* STEP 2 — 컨셉 설명 */}
        {step === 1 && (
          <CharacterFormFields value={value} onChange={setValue} />
        )}

        {/* STEP 3 — 추가 자료 (선택) */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              캐릭터 구체화에 도움이 될 추가 자료를 올려주세요. (선택 —
              건너뛰어도 됩니다)
            </p>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/60">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addExtras(e.target.files)}
              />
              클릭해서 이미지 추가 (여러 장 가능, 최대 10장)
            </label>
            {extras.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {extras.map((f, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded-md border border-[var(--border)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExtras((c) => c.filter((_, j) => j !== i))
                      }
                      className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 내비게이션 */}
      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={step === 0 ? () => router.back() : () => setStep((s) => s - 1)}
          disabled={submitting}
        >
          {step === 0 ? "취소" : "이전"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={submitting}>
            다음
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting ? "저장 중…" : "캐릭터 저장"}
          </Button>
        )}
      </div>
    </main>
  );
}
