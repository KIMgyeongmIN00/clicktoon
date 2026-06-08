import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Loading client-only state (localStorage, etc.) from useEffect after
      // hydration is a legitimate pattern in Next.js App Router and avoids
      // hydration mismatches. We accept the extra render.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
