import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:8000";

  return {
    base: process.env.NODE_ENV === "development" ? "/" : env.VITE_BASE_PATH || "/",
    optimizeDeps: {
      entries: ["src/main.tsx", "src/tempobook/**/*"],
    },
    plugins: [
      react(),
    ],
    resolve: {
      preserveSymlinks: true,
      alias: {
        "@": path.resolve((() => {
          // __dirname is not available in ESM; compute it from import.meta.url
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          return __dirname;
        })(), "./src"),
      },
    },
    server: {
      // @ts-ignore
      allowedHosts: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
