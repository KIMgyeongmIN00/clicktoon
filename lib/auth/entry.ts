"use client";

// API keys, set in My Page (/me). No entry gate — keys are the only auth.

export const KEY_GOOGLE = "omc:key:google";
export const KEY_OPENAI = "omc:key:openai";

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
