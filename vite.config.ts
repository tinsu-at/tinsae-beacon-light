// @lovable.dev/vite-tanstack-config already includes the core plugin stack.
// We only add the PWA plugin here for installability + a controlled service worker.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: { enabled: false },
      strategies: "generateSW",
      manifest: false, // served from public/manifest.webmanifest
      workbox: {
        navigateFallback: null,
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "beacon-pages",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              /\.(?:png|svg|webp|jpg|jpeg|woff2)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "beacon-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
