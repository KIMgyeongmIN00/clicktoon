"use client";
import { CharacterMeta } from "@/types/character";

// 미로그인 사용자의 캐릭터를 브라우저(IndexedDB)에 보관한다. 이미지 Blob을 그대로
// 저장하므로 localStorage 용량 제한을 피한다. 로그인/가입 완료 시 서버로 업로드 후
// 삭제된다(lib/local/sync.ts).

export type LocalCharacter = {
  id: string; // "local:" 접두 — 서버 uuid와 구분
  name: string;
  meta: CharacterMeta;
  images: { front?: Blob; side?: Blob; back?: Blob; extras: Blob[] };
  createdAt: number;
};

const DB_NAME = "clicktoon-local";
const STORE = "characters";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveLocalCharacter(input: {
  name: string;
  meta: CharacterMeta;
  images: { front?: Blob; side?: Blob; back?: Blob; extras: Blob[] };
}): Promise<LocalCharacter> {
  const char: LocalCharacter = {
    id: `local:${crypto.randomUUID()}`,
    name: input.name,
    meta: input.meta,
    images: input.images,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(char));
  return char;
}

export function listLocalCharacters(): Promise<LocalCharacter[]> {
  return tx<LocalCharacter[]>("readonly", (s) => s.getAll()).then((rows) =>
    rows.sort((a, b) => b.createdAt - a.createdAt),
  );
}

export function getLocalCharacter(id: string): Promise<LocalCharacter | undefined> {
  return tx<LocalCharacter | undefined>("readonly", (s) => s.get(id));
}

export function deleteLocalCharacter(id: string): Promise<void> {
  return tx("readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function isLocalId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("local:");
}

/** 로컬 캐릭터의 primary(정면 우선) 이미지 Blob. */
export function primaryImage(c: LocalCharacter): Blob | null {
  return c.images.front ?? c.images.side ?? c.images.back ?? null;
}
