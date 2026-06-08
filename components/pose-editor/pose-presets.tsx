"use client";
import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { PRESETS } from "./presets";
import {
  SavedPose,
  deleteSavedPose,
  listSavedPoses,
  savePoseEntry,
} from "@/lib/pose/saved-poses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PosePresets({
  currentBones,
  onApplyPreset,
  onApplyBones,
}: {
  currentBones: Record<string, [number, number, number]>;
  onApplyPreset: (id: string) => void;
  onApplyBones: (bones: Record<string, [number, number, number]>) => void;
}) {
  const [saved, setSaved] = useState<SavedPose[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setSaved(listSavedPoses());
  }, []);

  function handleSave() {
    const entry = savePoseEntry(name, currentBones);
    setSaved((prev) => [entry, ...prev]);
    setName("");
  }

  function handleDelete(id: string) {
    deleteSavedPose(id);
    setSaved((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      {/* Built-in presets */}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
          자세 프리셋
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.id)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save current pose */}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
          현재 자세 저장
        </div>
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="자세 이름"
            className="h-8 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSave}
            className="shrink-0"
          >
            <Save size={14} /> 저장
          </Button>
        </div>
      </div>

      {/* Saved poses list */}
      {saved.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
            저장한 자세
          </div>
          <div className="space-y-1">
            {saved.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] pl-2.5"
              >
                <button
                  type="button"
                  onClick={() => onApplyBones(p.bones)}
                  className="flex-1 truncate py-1.5 text-left text-xs text-[var(--foreground)] hover:text-[var(--accent)]"
                  title={p.name}
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="shrink-0 px-2 py-1.5 text-[var(--muted)] hover:text-[var(--danger)]"
                  title="삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
