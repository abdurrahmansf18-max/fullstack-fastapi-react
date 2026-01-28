import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const BACKEND = env.VITE_BACKEND_ORIGIN || "http://localhost:8000";
  const HMR_HOST = env.VITE_HMR_HOST || undefined; // e.g. abc123.ngrok-free.app
  const HMR_PROTOCOL = env.VITE_HMR_PROTOCOL || "wss"; // wss for https ngrok
  const HMR_PORT = env.VITE_HMR_PORT ? Number(env.VITE_HMR_PORT) : undefined;

  return {
    plugins: [react()],
    server: {
      host: true,
      strictPort: false,
      hmr: HMR_HOST
        ? { host: HMR_HOST, protocol: HMR_PROTOCOL as any, port: HMR_PORT }
        : true,
      proxy: {
        "/api": {
          target: BACKEND,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
      allowedHosts: [".ngrok-free.app"],
    },
  };
});
