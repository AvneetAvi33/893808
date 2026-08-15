import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Scene media can be very large; it is streamed, never precached.
        globIgnores: ["**/assets/video/**", "**/assets/audio/**"],
        navigateFallbackDenylist: [/^\/assets\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: "Zen Journeys",
        short_name: "Zen",
        description:
          "Pick a travelling scene, let it fill the screen, and breathe.",
        theme_color: "#08070b",
        background_color: "#08070b",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["lifestyle", "music", "entertainment"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        // The animation and audio libraries are split out so the entry chunk
        // stays small and the first paint is not waiting on either.
        manualChunks: (id: string) => {
          if (id.includes("framer-motion") || id.includes("/motion-dom/")) return "motion";
          if (id.includes("howler")) return "audio";
          return undefined;
        },
      },
    },
  },
});
