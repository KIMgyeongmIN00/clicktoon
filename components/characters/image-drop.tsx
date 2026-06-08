"use client";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export function ImageDrop({
  value,
  onChange,
  className,
}: {
  value: File | null;
  onChange: (file: File | null) => void;
  className?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) return;
      onChange(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result));
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition",
        dragging
          ? "border-[var(--accent)] bg-[var(--accent)]/5"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/60",
        className,
      )}
    >
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {preview || value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview ?? ""}
          alt="preview"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="text-center text-sm text-[var(--muted)]">
          <div>이미지를 드래그하거나 클릭해서 업로드</div>
          <div className="mt-1 text-xs">PNG / JPG / WEBP</div>
        </div>
      )}
    </label>
  );
}
