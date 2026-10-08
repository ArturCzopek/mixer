import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Private replay fixtures and third-party parser build artifacts.
    "backtest/.local/**",
    // Generated third-party WASM bindings, kept byte-for-byte with their provenance.
    "public/demo/demoparser2.js",
    "public/demo/demoparser2.d.ts",
  ]),
]);

export default eslintConfig;
