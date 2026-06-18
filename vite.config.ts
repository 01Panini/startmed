import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const landingPath = resolve(rootDir, "startmed-landing.html");
const adminPath = resolve(rootDir, "admin.html");

export default defineConfig({
  plugins: [
    {
      name: "startmed-html-routes",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const path = request.url?.split("?")[0];

          if (path === "/admin" || path === "/admin/") {
            request.url = request.url?.replace(path, "/admin.html");
          }

          next();
        });
      },
      transformIndexHtml: {
        order: "pre",
        handler(html, context) {
          if (["/admin", "/admin/", "/admin/index.html"].includes(context.path)) {
            return readFileSync(adminPath, "utf8");
          }

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
        admin: adminPath,
        landing: landingPath,
        privacy: resolve(rootDir, "privacy.html"),
      },
    },
  },
});
