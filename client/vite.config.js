import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const { VITE_TURNSTILE_SITE_KEY: turnstileSiteKey } = loadEnv(
    mode,
    process.cwd(),
    "VITE_",
  );
  if (mode === "production" && !turnstileSiteKey) {
    throw new Error(
      "VITE_TURNSTILE_SITE_KEY is required for production builds.",
    );
  }

  return {
    plugins: [react()],
    build: {
      assetsInlineLimit: 0, // WHY: data: URIs for fonts would violate font-src 'self'
      modulePreload: { polyfill: false }, // no injected inline polyfill
      sourcemap: false,
    },
    // Dev only: forward /api to a locally running API (needs CORS_ORIGINS=http://localhost:5173).
    server: { proxy: { "/api": "http://localhost:5000" } },
  };
});
