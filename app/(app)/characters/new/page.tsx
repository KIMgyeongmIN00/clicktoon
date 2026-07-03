"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CharacterFormFields,
  CharacterFormValue,
} from "@/components/characters/character-form";
import { ImageDrop } from "@/components/characters/image-drop";
import { makeThumbnail } from "@/lib/image/thumbnail";
import { generationCost } from "@/lib/credits/cost";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: CharacterFormValue = {
  name: "",
  meta: { mainConcept: "", proportions: {}, tags: [] },
};
const STEPS = ["시점 이미지", "컨셉 설명", "추가 자료"];

export default function NewCharacterPage() {
  const [mode, setMode] = useState<"upload" | "concept">("upload");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-5 text-xl font-semibold">새 캐릭터</h1>

      {/* 모드 선택 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={[
            "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition",
            mode === "upload"
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Upload size={14} /> 레퍼런스 업로드
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            정면/옆면/뒷면 이미지가 있어요
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("concept")}
          className={[
            "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition",
            mode === "concept"
              ? "border-[var(--accent)] bg-[var(--accent)]/10"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles size={14} /> AI 컨셉아트 생성
          </span>
          <span className="text-[11px] text-[var(--muted)]">
            이미지 하나로 컨셉아트까지 만들어요
          </span>
        </button>
      </div>

      {mode === "upload" ? <UploadFunnel /> : <ConceptFlow />}
    </main>
  );
}

/* ── 경로 A — 3-step 업로드 퍼널 ── */
function UploadFunnel() {
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
    <>
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
                i === step ? "text-[var(--foreground)]" : "text-[var(--muted)]"
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
          </div>
        )}

        {step === 1 && <CharacterFormFields value={value} onChange={setValue} />}

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

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={
            step === 0 ? () => router.back() : () => setStep((s) => s - 1)
          }
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
    </>
  );
}

/* ── 경로 B — 단일 이미지 → AI 컨셉아트 ── */
type ConceptPhase = "input" | "generating" | "done" | "failed";

function ConceptFlow() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [phase, setPhase] = useState<ConceptPhase>("input");
  const [error, setError] = useState("");
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [adopting, setAdopting] = useState(false);
  const cost = generationCost("google");

  async function poll(genId: string) {
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, 2500));
      const r = await fetch(`/api/generations/${genId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "상태 조회 실패");
      if (j.generation?.status === "done") {
        setResultUrl(j.result_url);
        return;
      }
      if (j.generation?.status === "failed")
        throw new Error(j.generation?.error_message ?? "생성 실패");
    }
    throw new Error("시간 초과 — 잠시 후 캐릭터 페이지에서 확인해주세요");
  }

  async function generate() {
    if (!file) {
      toast.error("캐릭터 이미지를 올려주세요");
      return;
    }
    if (!name.trim() || !concept.trim()) {
      toast.error("이름과 컨셉 설명은 필수입니다");
      return;
    }
    setPhase("generating");
    setError("");
    try {
      const thumb = await makeThumbnail(file).catch(() => null);
      const form = new FormData();
      form.set("file", file);
      if (thumb) form.set("thumb", thumb);
      form.set("name", name);
      form.set(
        "meta",
        JSON.stringify({ mainConcept: concept, proportions: {}, tags: [] }),
      );
      form.set("provider", "google");
      const r = await fetch("/api/characters/from-concept", {
        method: "POST",
        body: form,
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.code === "INSUFFICIENT_CREDITS") {
          toast.error("크레딧이 부족합니다", {
            action: { label: "충전", onClick: () => location.assign("/charge") },
          });
          setPhase("input");
          return;
        }
        throw new Error(json.error ?? "요청 실패");
      }
      setCharacterId(json.character.id);
      setGenerationId(json.generationId);
      await poll(json.generationId);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("failed");
    }
  }

  async function adopt() {
    if (!characterId || !generationId) return;
    setAdopting(true);
    try {
      const r = await fetch(`/api/characters/${characterId}/adopt-concept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "채택 실패");
      toast.success("컨셉아트를 대표 이미지로 설정했어요");
      router.replace(`/characters/${characterId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setAdopting(false);
    }
  }

  if (phase === "generating")
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-sm text-[var(--muted)]">
        <RefreshCw size={24} className="animate-spin" />
        AI가 컨셉아트를 그리는 중… (1~2분)
      </div>
    );

  if (phase === "done" && resultUrl)
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted)]">
          컨셉아트가 완성됐어요. 캐릭터 대표 이미지로 사용할까요?
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resultUrl}
          alt="컨셉아트"
          className="mx-auto max-h-[420px] rounded-lg border border-[var(--border)]"
        />
        <div className="flex justify-center gap-2">
          <Button onClick={adopt} disabled={adopting}>
            {adopting ? "적용 중…" : "이 컨셉아트를 대표로 사용"}
          </Button>
          <Link href={`/characters/${characterId}`}>
            <Button variant="outline">원본 그대로 사용</Button>
          </Link>
        </div>
      </div>
    );

  if (phase === "failed")
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-3">
          <div className="text-xs font-medium text-[var(--danger)]">
            컨셉아트 생성 실패
          </div>
          <p className="mt-1 break-keep text-[11px] text-[var(--muted)]">
            {error} (실패한 생성은 크레딧이 환불됩니다)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPhase("input")}>
            다시 시도
          </Button>
          {characterId && (
            <Link href={`/characters/${characterId}`}>
              <Button variant="ghost">원본으로 캐릭터 보기</Button>
            </Link>
          )}
        </div>
      </div>
    );

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <ImageDrop value={file} onChange={setFile} />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="캐릭터 이름"
          />
        </div>
        <div className="space-y-1.5">
          <Label>컨셉 설명</Label>
          <Input
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="예: 은발 검사, 미래 도시의 해커 소녀"
          />
        </div>
        <p className="text-[11px] text-[var(--muted)]">
          러프 스케치·사진 한 장이면 충분해요. AI가 정면 전신 컨셉아트로
          정제합니다. 예상 소요 약{" "}
          <span className="font-medium text-[var(--foreground)]">
            {cost.credits} 크레딧
          </span>
        </p>
        <Button onClick={generate} className="w-full">
          <Sparkles size={15} /> 컨셉아트 생성
        </Button>
      </div>
    </div>
  );
}
