import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Public ingestion configuration, not an API secret. Explicit env values override
  // these defaults; only Vercel production collects analytics automatically.
  env: {
    NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? "241a913b00508c200214be0fa6ecdfbf",
    NEXT_PUBLIC_MIXPANEL_REGION: process.env.NEXT_PUBLIC_MIXPANEL_REGION ?? "US",
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED ?? String(process.env.VERCEL_ENV === "production"),
    NEXT_PUBLIC_ANALYTICS_ENVIRONMENT: process.env.NEXT_PUBLIC_ANALYTICS_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
  },
};

export default nextConfig;
