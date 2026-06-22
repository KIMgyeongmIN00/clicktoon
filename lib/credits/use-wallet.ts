"use client";
import { useCallback, useEffect, useState } from "react";

// 서버 지갑 잔액을 읽는 훅. (localStorage 크레딧을 대체 — C3)
export function useWallet() {
  const [balance, setBalance] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/wallet");
      if (!r.ok) return;
      const j = await r.json();
      setBalance(typeof j.balance === "number" ? j.balance : 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, refresh };
}
