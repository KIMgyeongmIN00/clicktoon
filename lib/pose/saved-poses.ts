"use client";

// User-saved poses (bone rotations only), persisted in localStorage.

const KEY = "omc:saved-poses";

export type SavedPose = {
  id: string;
  name: string;
  bones: Record<string, [number, number, number]>;
  createdAt: number;
};

export function listSavedPoses(): SavedPose[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedPose[];
    if (!Array.isArray(arr)) return [];
    return arr.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeAll(poses: SavedPose[]) {
  window.localStorage.setItem(KEY, JSON.stringify(poses));
}

export function savePoseEntry(
  name: string,
  bones: Record<string, [number, number, number]>,
): SavedPose {
  const entry: SavedPose = {
    id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    name: name.trim() || "이름 없는 자세",
    bones,
    createdAt: Date.now(),
  };
  const all = listSavedPoses();
  writeAll([entry, ...all]);
  return entry;
}

export function deleteSavedPose(id: string) {
  writeAll(listSavedPoses().filter((p) => p.id !== id));
}
