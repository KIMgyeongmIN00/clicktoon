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
  meta: {
    mainConcept: "",
    proportions: {},
    tags: [],
  },
};

export default function NewCharacterPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState<CharacterFormValue>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("레퍼런스 이미지를 업로드하세요");
      return;
    }
    if (!value.name.trim() || !value.meta.mainConcept.trim()) {
      toast.error("이름과 메인 컨셉은 필수입니다");
      return;
    }
    setSubmitting(true);
    try {
      const thumb = await makeThumbnail(file).catch(() => null);
      const form = new FormData();
      form.set("file", file);
      if (thumb) form.set("thumb", thumb);
      form.set("name", value.name);
      form.set("meta", JSON.stringify(value.meta));
      const r = await fetch("/api/characters", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "upload failed");
      toast.success("캐릭터 추가 완료");
      router.replace(`/characters/${json.character.id}`);
    } catch (e) {
      toast.error(`업로드 실패: ${(e as Error).message}`);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">새 캐릭터</h1>
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-[280px_1fr]">
        <div>
          <ImageDrop value={file} onChange={setFile} />
        </div>
        <div className="space-y-6">
          <CharacterFormFields value={value} onChange={setValue} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "저장 중…" : "저장"}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
