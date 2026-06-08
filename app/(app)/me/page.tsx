"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { getStoredKeys, saveKeys } from "@/lib/auth/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function MyPage() {
  const [google, setGoogle] = useState("");
  const [openai, setOpenai] = useState("");
  const [showG, setShowG] = useState(false);
  const [showO, setShowO] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const k = getStoredKeys();
    setGoogle(k.google ?? "");
    setOpenai(k.openai ?? "");
  }, []);

  function save() {
    setSaving(true);
    saveKeys(google, openai);
    toast.success("API 키 저장 완료");
    setSaving(false);
  }

  function clearKeys() {
    if (!confirm("저장된 API 키를 모두 지울까요?")) return;
    saveKeys("", "");
    setGoogle("");
    setOpenai("");
    toast.success("API 키 삭제 완료");
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">마이페이지</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">API 키 설정</CardTitle>
          <p className="text-xs text-[var(--muted)]">
            키는 이 브라우저의 localStorage에만 저장되고, AI 호출 시점에만
            서버로 전달됩니다. 공용 PC에서는 사용 후 비워주세요.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Google Gemini API Key</Label>
            <div className="relative">
              <Input
                type={showG ? "text" : "password"}
                placeholder="AIza..."
                value={google}
                onChange={(e) => setGoogle(e.target.value)}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowG((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                tabIndex={-1}
              >
                {showG ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--muted)]">
              aistudio.google.com/apikey 에서 발급
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>OpenAI API Key</Label>
            <div className="relative">
              <Input
                type={showO ? "text" : "password"}
                placeholder="sk-..."
                value={openai}
                onChange={(e) => setOpenai(e.target.value)}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowO((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                tabIndex={-1}
              >
                {showO ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-[var(--muted)]">
              platform.openai.com/api-keys 에서 발급
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={clearKeys}>
          <Trash2 size={15} /> 키 비우기
        </Button>
      </div>
    </main>
  );
}
