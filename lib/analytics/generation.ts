import { z } from "zod";
import { trackServer } from "./server";

const outcomeRow = z.object({
  id: z.string(), owner: z.string(), kind: z.enum(["pose", "concept"]),
  provider: z.enum(["google", "openai"]), created_at: z.string(), updated_at: z.string(),
});

/** Takes only a row returned by the conditional DB transition; duplicate callbacks emit nothing. */
export async function trackGenerationOutcome(raw: unknown, status: "done" | "failed", isDemo = false, message = "") {
  const parsed = outcomeRow.safeParse(raw);
  if (!parsed.success) return;
  const row = parsed.data;
  const elapsed = Date.parse(row.updated_at) - Date.parse(row.created_at);
  if (!Number.isFinite(elapsed)) return;
  const properties = {
    generation_id: row.id, kind: row.kind, provider: row.provider,
    elapsed_ms: Math.max(0, elapsed),
  };
  const context = { userId: row.owner, eventKey: row.id, occurredAt: row.updated_at, isDemo };
  if (status === "done") await trackServer("generation_succeeded", properties, context);
  else {
    const failureType = /429|rate.limit|quota/i.test(message) ? "rate_limit"
      : /timeout|timed.out/i.test(message) ? "timeout"
      : /content.policy|moderation|safety/i.test(message) ? "content_policy" : "other";
    await trackServer("generation_failed", { ...properties, failure_type: failureType }, context);
  }
}
