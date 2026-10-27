"use client";

import mixpanel from "mixpanel-browser";
import { isDemoUi } from "@/lib/demo-client";
import { analyticsEnabled, analyticsEnvironment, analyticsPage, isInternalUser, mixpanelHost } from "./config";
import { validProperties, type EventFor, type EventProperties } from "./events";

let initialized = false;
let userId: string | null = null;

export function initAnalytics() {
  if (initialized) return true;
  if (typeof window === "undefined" || !analyticsEnabled()) return false;
  try {
    mixpanel.init(process.env.NEXT_PUBLIC_MIXPANEL_TOKEN!, {
      api_host: mixpanelHost(),
      autocapture: false,
      track_pageview: false,
      record_sessions_percent: 0,
      record_heatmap_data: false,
      record_canvas: false,
      remote_settings_mode: "disabled",
      persistence: "localStorage",
      save_referrer: false,
      store_google: false,
      skip_first_touch_marketing: true,
      ip: false,
      property_blacklist: ["$current_url", "$referrer", "$initial_referrer", "$initial_referring_domain"],
    });
    const persisted = mixpanel.get_property("$user_id");
    userId = typeof persisted === "string" ? persisted : null;
    initialized = true;
    return true;
  } catch { return false; }
}

export function trackLoginStarted(method: "google" | "password") {
  if (!initAnalytics()) return;
  try { sessionStorage.setItem("clicktoon:login-pending", String(Date.now())); } catch { /* Optional correlation. */ }
  track("login_started", { method });
}

export function identifyAnalytics(nextUserId: string | null) {
  if (!initAnalytics()) return;
  try {
    if (userId && nextUserId !== userId) mixpanel.reset();
    userId = nextUserId;
    if (nextUserId) mixpanel.identify(nextUserId);
  } catch { /* Analytics must not interrupt authentication. */ }
}

export function track<E extends EventFor<"browser">>(name: E, properties: EventProperties<E>) {
  if (!initAnalytics()) return;
  const safe = validProperties(name, properties);
  if (!safe) return;
  try {
    mixpanel.track(name, {
      ...safe,
      schema_version: 1,
      environment: analyticsEnvironment(),
      source: "browser",
      page: analyticsPage(window.location.pathname),
      is_authenticated: !!userId,
      is_internal: isInternalUser(userId),
      is_demo: isDemoUi(),
      is_pose_debug: new URLSearchParams(window.location.search).get("poseDebug") === "1",
    });
  } catch { /* Blocked storage/network must not break product actions. */ }
}
