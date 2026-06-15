"use client";
import { useEffect, useState } from "react";
import { CREDITS_EVENT, getCredits } from "./store";

// Reactive read of the local credit balance. Updates on same-tab changes
// (custom event) and cross-tab changes (native storage event).
export function useCredits(): number {
  const [credits, setCreditsState] = useState(0);

  useEffect(() => {
    const sync = () => setCreditsState(getCredits());
    sync();
    window.addEventListener(CREDITS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CREDITS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return credits;
}
