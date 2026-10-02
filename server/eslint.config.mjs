import js from "@eslint/js";
import globals from "globals";
import security from "eslint-plugin-security";

export default [
  { ignores: ["coverage/", "node_modules/"] },
  js.configs.recommended,
  security.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // WHY off: this rule flags EVERY obj[variable] access (e.g. totals[type] on a fixed
      // allowlist), so it produces mostly false positives. Real injection paths here are covered
      // by Zod .strict() schemas, express-mongo-sanitize, and the CodeQL job.
      "security/detect-object-injection": "off",

      // Everything else from the security plugin stays at its recommended level (warnings fail CI via
      // --max-warnings 0 in the lint script). If one fires, treat it as a real finding first.
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["error", "always"],
      // WHY: console.* bypasses the redacting JSON logger. env.js uses console.error on purpose
      // because it runs before the logger can exist.
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
];
