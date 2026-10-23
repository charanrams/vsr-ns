import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Ports and the backend address come from frontend/.env (see .env.example)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backend = env.VITE_API_URL || env.VITE_DEV_PROXY_TARGET || 'http://localhost:5050';
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      // Used when VITE_API_URL is empty: the site calls /api and /socket.io on its own origin
      proxy: {
        '/api': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
  };
});
