import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
          { src: "icons/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
