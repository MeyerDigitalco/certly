import next from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * There was no config file at all, so `npx eslint` refused to run and
 * `next lint` had already been removed from Next 16. Nothing was being
 * linted; the only static check was the type checker.
 */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      "supabase/**",
    ],
  },
  ...[next, nextCoreWebVitals, nextTypescript].flat(),
];

export default config;
