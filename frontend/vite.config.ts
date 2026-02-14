import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["offline.html"],
      manifest: {
        name: "DirectStock Lagerverwaltung",
        short_name: "DirectStock",
        description: "DirectStock Lagerverwaltung als installierbare PWA",
        start_url: "/",
        display: "standalone",
        theme_color: "#1753a5",
        background_color: "#edf2fa",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern:
              /\/api\/(products|product-groups|warehouses|zones|bins)(?:\/.*)?(?:\?.*)?$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-master-data",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern:
              /\/api\/(inventory|dashboard|goods-[^/]+|stock-transfers)(?:\/.*)?(?:\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-live-data",
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 15,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("react") || id.includes("scheduler")) {
            return "vendor-react";
          }
          if (id.includes("react-router")) {
            return "vendor-router";
          }
          if (id.includes("@tanstack")) {
            return "vendor-query";
          }
          if (id.includes("axios")) {
            return "vendor-http";
          }
          if (id.includes("zustand")) {
            return "vendor-state";
          }
          if (id.includes("html5-qrcode")) {
            return "vendor-scanner";
          }
          return "vendor-misc";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    clearMocks: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
