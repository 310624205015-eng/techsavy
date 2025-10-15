import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  return {
    plugins: [
      react(),
      {
        name: 'configure-server',
        configureServer(server) {
          import('./src/server/middleware').then(({ default: middleware }) => {
            server.middlewares.use(middleware);
          });
        },
      },
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
