import {
  signPayload
} from "../../../../chunk-XW2K676Y.mjs";
import {
  schedules_exports
} from "../../../../chunk-ELOAX26M.mjs";
import "../../../../chunk-6QZW5TDQ.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-SNESNKQK.mjs";

// trigger/reaper.ts
init_esm();
var reapStuckGenerations = schedules_exports.task({
  id: "reap-stuck-generations",
  cron: "*/10 * * * *",
  run: /* @__PURE__ */ __name(async () => {
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
        "X-Signature": signPayload(secret, ts, body)
      },
      body
    });
    if (!r.ok) throw new Error(`reap failed: ${r.status} ${await r.text()}`);
    return await r.json();
  }, "run")
});
export {
  reapStuckGenerations
};
//# sourceMappingURL=reaper.mjs.map
