"use client";

// Temporary client-side credit balance. Lives in localStorage with no server/
// user binding yet — login + Supabase persistence comes later, at which point
// this becomes a read-through cache of the server balance.
// TODO(auth): move the source of truth to a `credits` table keyed by user id.

const KEY_CREDITS = "omc:credits";
const EVENT = "omc:credits-changed";

export function getCredits(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY_CREDITS);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function setCredits(n: number): number {
  const next = Math.max(0, Math.floor(n));
  window.localStorage.setItem(KEY_CREDITS, String(next));
  // Notify same-tab listeners (the native `storage` event only fires in OTHER tabs).
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  return next;
}

export function addCredits(amount: number): number {
  if (typeof window === "undefined") return 0;
  return setCredits(getCredits() + amount);
}

// Returns false (without spending) when the balance is insufficient.
export function spendCredits(amount: number): boolean {
  if (typeof window === "undefined") return false;
  const cur = getCredits();
  if (cur < amount) return false;
  setCredits(cur - amount);
  return true;
}

export const CREDITS_EVENT = EVENT;
