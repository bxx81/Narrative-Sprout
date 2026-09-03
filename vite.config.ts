import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { version } from "./package.json";
import license from "rollup-plugin-license";
import path from "path";
import fs from "fs-extra";

const outDir = path.resolve(import.meta.dirname, "./dist");

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // Vendor chunks (zod 90 kB / react 243 kB raw) are split below for PWA
    // cache efficiency: app code changes every release, vendors only with
    // version bumps, so per-release re-downloads stay small. The largest
    // realistic chunk is the app bundle itself (~550 kB raw, ~180 kB gzip),
    // hence the raised warning limit.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Vendor separation for PWA cache efficiency: the app code changes on
        // every release, but these vendors only change with their versions —
        // splitting keeps the per-release re-download (and precache diff)
        // small. Zod alone is heavy (v4 full bundle); splitting it also
        // clears the 500 kB chunk warning.
        manualChunks(id) {
          if (id.includes("node_modules/zod/")) return "zod";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router/") ||
            id.includes("node_modules/react-i18next/") ||
            id.includes("node_modules/react-hot-toast/")
          ) {
            return "react";
          }
          if (id.includes("node_modules/i18next/")) return "i18next";
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // 再設計書 §7: 軽量な JS/CSS/HTML/json は precache、重い webp 背景やフォントは
      // runtimeCaching に回す（globPatterns に webp を入れると初回インストールが激重になる）
      workbox: {
        globPatterns: ["**/*.{js,css,html,json,svg,ico}"],
        runtimeCaching: [
          {
            urlPattern: /\/(images|s)\/.*\.(webp|woff2?|ttf|otf)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: "Narrative Sprout",
        short_name: "Narrative Sprout",
        description: "An AI-powered interactive visual novel.",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        icons: [
          { src: "icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
    license({
      sourcemap: true,
      thirdParty: {
        allow: "(MIT OR Apache-2.0 OR ISC)",
        includePrivate: false,
        multipleVersions: true,
        output: {
          file: path.join(path.resolve(import.meta.dirname, "./public/legal"), "license.html"),
          encoding: "utf-8",
          template(dependencies) {
            const body = dependencies
              .map((dep) => {
                const repository =
                  dep.repository && typeof dep.repository === "object"
                    ? dep.repository.url
                    : dep.repository;
                const author =
                  dep.author && typeof dep.author === "object" ? dep.author.name : dep.author;

                return [
                  `Name: ${dep.name}`,
                  `Version: ${dep.version}`,
                  `License: ${dep.license}`,
                  `Private: ${dep.private}`,
                  `Description: ${dep.description || ""}`,
                  `Repository: ${repository || ""}`,
                  `Homepage: ${dep.homepage || ""}`,
                  `Author: ${author || ""}`,
                  `License Text:`,
                  `===`,
                  ``,
                  dep.licenseText || "",
                  ``,
                  `---`,
                ].join("\n");
              })
              .join("\n\n");
            const addLicense = `FALLBACK_BG_SVG: https://www.svgbackgrounds.com/set/free-svg-backgrounds-and-patterns/ Free SVG Backgrounds and Patterns by SVGBackgrounds.com
Error sound: https://pixabay.com/sound-effects/film-special-effects-error-08-206492/
Notification sound: https://pixabay.com/sound-effects/film-special-effects-system-notification-199277/`;

            const fullHtml = `<html>\n<pre>\n${body}\n${addLicense}\n</pre>\n</html>`;

            // ビルド出力先へも直接書き込む
            try {
              if (!fs.existsSync(outDir)) {
                fs.ensureDirSync(outDir);
              }
              fs.writeFileSync(path.join(outDir, "license.html"), fullHtml, "utf-8");
            } catch (e) {
              console.error("Failed to write license.html to outDir:", e);
            }

            return fullHtml;
          },
        },
      },
    }),
  ],
});
