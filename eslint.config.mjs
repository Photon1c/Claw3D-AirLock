import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["server/**/*.js", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    excludedFiles: ["src/app/api/**", "src/lib/studio/settings-store.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "process",
          message:
            "Do not access process.env directly in client code. " +
            "Use NEXT_PUBLIC_ prefixed variables for client-safe values, " +
            "or move the logic to a Next.js API route. " +
            "See AGENTS.md for the environment variable policy.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored third-party code (kept as-is; linting it adds noise).
    "src/lib/avatars/vendor/**",
  ]),
  prettier,
]);

export default eslintConfig;
