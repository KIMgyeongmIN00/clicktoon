"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isEntered } from "./entry";

export function EntryGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isEntered()) {
      router.replace("/enter");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-500">
        loading…
      </div>
    );
  }
  return <>{children}</>;
}
