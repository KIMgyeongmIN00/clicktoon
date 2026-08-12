"use client";
import { useState } from "react";
import { ChevronDown, Plus, User, X } from "lucide-react";
import { CharacterWithUrls } from "@/types/character";
import { Figure, MAX_FIGURES } from "@/types/pose";
import { CharacterPicker } from "./character-picker";

// 장면에 선 마네킹 목록. 행을 누르면 그 피규어가 선택되고(캔버스의 기즈모·
// 관절 마커가 따라 옮겨간다), 각 행에서 연기할 캐릭터를 배정한다.
export function SceneFigures({
  figures,
  characters,
  selectedFigureId,
  loading,
  onSelectFigure,
  onAddFigure,
  onRemoveFigure,
  onAssignCharacter,
}: {
  figures: Figure[];
  characters: CharacterWithUrls[];
  selectedFigureId: string | null;
  loading: boolean;
  onSelectFigure: (figureId: string) => void;
  onAddFigure: () => void;
  onRemoveFigure: (figureId: string) => void;
  onAssignCharacter: (figureId: string, characterId: string) => void;
}) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const byId = new Map(characters.map((c) => [c.id, c]));
  const canAdd = figures.length < MAX_FIGURES;
  const canRemove = figures.length > 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          장면 구성 · {figures.length}/{MAX_FIGURES}
        </div>
        <button
          type="button"
          onClick={onAddFigure}
          disabled={!canAdd}
          title={
            canAdd
              ? "캐릭터 추가"
              : `한 장면에는 최대 ${MAX_FIGURES}명까지 세울 수 있어요`
          }
          className="flex items-center gap-0.5 text-[10px] text-[var(--accent)] transition hover:underline disabled:cursor-not-allowed disabled:text-[var(--muted)] disabled:no-underline"
        >
          <Plus size={11} /> 캐릭터 추가
        </button>
      </div>

      <div className="space-y-1.5">
        {figures.map((f, i) => {
          const character = f.characterId ? byId.get(f.characterId) : null;
          const active = f.id === selectedFigureId;
          const open = pickerFor === f.id;
          return (
            <div
              key={f.id}
              className={[
                "rounded-md border transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-[var(--surface)]",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => onSelectFigure(f.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-2)]">
                    {character ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={character.thumb_url ?? character.ref_url}
                        alt={character.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User size={14} className="text-[var(--muted)]" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {character?.name ?? "캐릭터 미배정"}
                    </span>
                    <span className="block text-[10px] text-[var(--muted)]">
                      피규어 {i + 1}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onRemoveFigure(f.id)}
                  disabled={!canRemove}
                  title={
                    canRemove ? "장면에서 빼기" : "최소 한 명은 있어야 해요"
                  }
                  className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-[var(--muted)]"
                >
                  <X size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setPickerFor(open ? null : f.id)}
                className="flex w-full items-center gap-1 border-t border-[var(--border)] px-2 py-1.5 text-[10px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                <ChevronDown
                  size={11}
                  className={open ? "rotate-180 transition" : "transition"}
                />
                캐릭터 {character ? "변경" : "배정"}
              </button>

              {open && (
                <div className="border-t border-[var(--border)] p-2">
                  <CharacterPicker
                    characters={characters}
                    selectedId={f.characterId}
                    onSelect={(id) => {
                      onAssignCharacter(f.id, id);
                      setPickerFor(null);
                    }}
                    loading={loading}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
