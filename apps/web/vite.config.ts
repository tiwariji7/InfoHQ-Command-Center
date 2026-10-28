import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clerkPublishableKey =
    env.VITE_CLERK_PUBLISHABLE_KEY ||
    env.CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.CLERK_PUBLISHABLE_KEY ||
    '';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkPublishableKey),
    },
    server: {
      port: 5173,
      proxy: {
        '/__clerk': {
          target: 'https://clerk.infohq.in',
          changeOrigin: true,
          followRedirects: true,
          rewrite: (path) => path.replace(/^\/__clerk/, ''),
          headers: {
            Origin: 'https://infohq.in',
          },
          cookieDomainRewrite: 'localhost',
        },
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
});
