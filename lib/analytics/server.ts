import { createHash } from "node:crypto";
import { analyticsEnabled, analyticsEnvironment, isInternalUser, mixpanelHost } from "./config";
import { validProperties, type EventFor, type EventProperties } from "./events";

type Context = { userId: string; eventKey: string; isDemo?: boolean; occurredAt?: string };

/** Await in jobs; route handlers may schedule this using Next's after(). No retries/outbox. */
export async function trackServer<E extends EventFor<"server">>(name: E, properties: EventProperties<E>, context: Context) {
  if (!analyticsEnabled()) return;
  try {
    const safe = validProperties(name, properties);
    if (!safe) return;
    const response = await fetch(`${mixpanelHost()}/track?ip=0&verbose=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(1500),
      body: JSON.stringify([{
        event: name,
        properties: {
          ...safe,
          token: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
          distinct_id: context.userId,
          $user_id: context.userId,
          $insert_id: createHash("sha256").update(`${name}:${context.eventKey}`).digest("hex").slice(0, 32),
          time: Math.floor((context.occurredAt ? Date.parse(context.occurredAt) : Date.now()) / 1000),
          schema_version: 1,
          environment: analyticsEnvironment(),
          source: "server",
          is_authenticated: true,
          is_internal: isInternalUser(context.userId),
          is_demo: context.isDemo ?? false,
        },
      }]),
    });
    const result = await response.json();
    if (!response.ok || result.status !== 1) console.warn("[analytics] delivery rejected", name);
  } catch { console.warn("[analytics] delivery unavailable", name); }
}
