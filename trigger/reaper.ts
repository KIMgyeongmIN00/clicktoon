import { schedules } from "@trigger.dev/sdk";
import { signPayload } from "@/lib/crypto/hmac";

// 10분마다 Next의 reap 엔드포인트를 HMAC 서명으로 호출해 stuck 생성을 정리한다.
// (Next가 유일한 DB 작성자이므로 sweep도 Next 경유 — D2-B 일관성)
export const reapStuckGenerations = schedules.task({
  id: "reap-stuck-generations",
  cron: "*/10 * * * *",
  run: async () => {
    const appUrl = process.env.APP_URL;
    const secret = process.env.WORKER_CALLBACK_SECRET;
    if (!appUrl || !secret)
      throw new Error("APP_URL / WORKER_CALLBACK_SECRET missing in task env");

    const ts = String(Date.now());
    const body = "{}";
    const r = await fetch(`${appUrl}/api/jobs/reap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Role": "worker",
        "X-Timestamp": ts,
        "X-Signature": signPayload(secret, ts, body),
      },
      body,
    });
    if (!r.ok) throw new Error(`reap failed: ${r.status} ${await r.text()}`);
    return await r.json();
  },
});
