"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/browser";
import { identifyAnalytics, initAnalytics, track } from "@/lib/analytics/browser";
import { analyticsPage } from "@/lib/analytics/config";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const lastPage = useRef<string | null>(null);
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    if (!initAnalytics()) return;
    const { data: { subscription } } = browserSupabase().auth.onAuthStateChange((event, session) => {
      const nextId = session?.user.id ?? null;
      identifyAnalytics(nextId);
      setIdentityReady(true);
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && nextId) {
        // OAuth redirects reload the page; sessionStorage bridges only the initiated login.
        try {
          const pending = Number(sessionStorage.getItem("clicktoon:login-pending"));
          if (pending) {
            sessionStorage.removeItem("clicktoon:login-pending");
            if (Date.now() - pending < 10 * 60 * 1000) track("login_completed", {});
          }
        } catch { /* Storage may be blocked. */ }
      }
      if (event === "SIGNED_OUT") track("logout_completed", {});
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!identityReady || !pathname || !initAnalytics() || lastPage.current === pathname) return;
    lastPage.current = pathname;
    const params = new URLSearchParams(window.location.search);
    const campaign = (key: string) => {
      const value = params.get(key);
      return value && /^[\w.\- ]{1,128}$/.test(value) ? value : undefined;
    };
    let referrerHost: string | undefined;
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : undefined; } catch { /* No referrer. */ }
    track("page_viewed", {
      page: analyticsPage(pathname),
      referrer_host: referrerHost,
      utm_source: campaign("utm_source"),
      utm_medium: campaign("utm_medium"),
      utm_campaign: campaign("utm_campaign"),
    });
  }, [pathname, identityReady]);

  return null;
}
