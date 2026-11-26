import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Plugin local para que /api/push funcione exactamente igual en `npm run dev`
 * que cuando se despliega como Serverless Function en Vercel.
 */
function localVercelApiPlugin(env) {
  return {
    name: 'local-vercel-api',
    configureServer(server) {
      server.middlewares.use('/api/push', (req, res) => {
        Object.assign(process.env, env);
        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', async () => {
          try {
            req.body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            req.body = {};
          }
          const { default: pushHandler } = await import('./api/push.js');
          await pushHandler(req, res);
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), localVercelApiPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
