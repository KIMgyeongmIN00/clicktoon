"use client";
import { Provider } from "@/lib/providers/types";

const OPTIONS: { id: Provider; label: string; hint: string }[] = [
  { id: "google", label: "Google Nano Banana 2", hint: "gemini-3.1-flash-image-preview" },
  { id: "openai", label: "OpenAI gpt-image-2", hint: "ducttape" },
];

export function ProviderPicker({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (next: Provider) => void;
}) {
  return (
    <div className="grid gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            "rounded-md border px-3 py-2 text-left text-sm transition",
            value === o.id
              ? "border-[var(--accent)] bg-[var(--accent)]/15"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
          ].join(" ")}
        >
          <div className="font-medium">{o.label}</div>
          <div className="text-[10px] text-[var(--muted)]">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}
