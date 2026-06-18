import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const landingPath = resolve(rootDir, "startmed-landing.html");

export default defineConfig({
  plugins: [
    {
      name: "startmed-landing-as-index",
      transformIndexHtml: {
        order: "pre",
        handler(html, context) {
          return context.path === "/" || context.path === "/index.html"
            ? readFileSync(landingPath, "utf8")
            : html;
        },
      },
    },
    react(),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(rootDir, "index.html"),
        admin: resolve(rootDir, "admin.html"),
        landing: landingPath,
        privacy: resolve(rootDir, "privacy.html"),
      },
    },
  },
});
