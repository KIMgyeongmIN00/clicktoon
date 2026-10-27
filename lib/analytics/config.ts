/** Public build-time configuration is shared by browser and server. */
export function analyticsEnabled() {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" &&
    !!process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
}

export function analyticsEnvironment() {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENVIRONMENT || process.env.NODE_ENV;
}

export function isInternalUser(userId: string | null) {
  return !!userId && (process.env.NEXT_PUBLIC_ANALYTICS_INTERNAL_USER_IDS || "")
    .split(",").map((value) => value.trim()).includes(userId);
}

export function mixpanelHost() {
  return process.env.NEXT_PUBLIC_MIXPANEL_REGION === "EU"
    ? "https://api-eu.mixpanel.com" : "https://api-js.mixpanel.com";
}

export function analyticsPage(pathname: string) {
  return pathname.replace(/^(\/characters)\/[^/]+$/, "$1/:id");
}
