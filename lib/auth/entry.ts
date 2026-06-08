"use client";

export const AUTH_FLAG_KEY = "omc:auth-ok";
export const KEY_GOOGLE = "omc:key:google";
export const KEY_OPENAI = "omc:key:openai";

export function getValidCodes(): string[] {
  const raw = process.env.NEXT_PUBLIC_ENTRY_CODES ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Entry gate: validate just the internal code. API keys are managed separately
// in My Page (/me).
export function tryEnter(code: string): boolean {
  const codes = getValidCodes();
  if (codes.length === 0) return false;
  const ok = codes.includes(code.trim());
  if (ok && typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_FLAG_KEY, "1");
  }
  return ok;
}

export function isEntered(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTH_FLAG_KEY) === "1";
}

export function exitGate(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_FLAG_KEY);
}

// ---- API keys (set in My Page) ----

export type StoredKeys = { google: string | null; openai: string | null };

export function getStoredKeys(): StoredKeys {
  if (typeof window === "undefined") return { google: null, openai: null };
  return {
    google: window.localStorage.getItem(KEY_GOOGLE),
    openai: window.localStorage.getItem(KEY_OPENAI),
  };
}

export function saveKeys(google: string, openai: string): void {
  if (typeof window === "undefined") return;
  const g = google.trim();
  const o = openai.trim();
  if (g) window.localStorage.setItem(KEY_GOOGLE, g);
  else window.localStorage.removeItem(KEY_GOOGLE);
  if (o) window.localStorage.setItem(KEY_OPENAI, o);
  else window.localStorage.removeItem(KEY_OPENAI);
}

export function hasKey(provider: "google" | "openai"): boolean {
  const keys = getStoredKeys();
  return provider === "google" ? !!keys.google : !!keys.openai;
}
