"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { tryEnter } from "@/lib/auth/entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EnterPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (tryEnter(code)) {
      toast.success("입장 완료");
      router.replace("/");
    } else {
      toast.error("진입코드가 올바르지 않습니다.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">클릭툰</CardTitle>
          <p className="text-xs text-[var(--muted)]">
            내부 진입코드를 입력하세요. API 키는 입장 후 마이페이지에서 설정합니다.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              autoFocus
              placeholder="entry code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={submitting}
            />
            <Button type="submit" disabled={!code.trim() || submitting}>
              입장
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
