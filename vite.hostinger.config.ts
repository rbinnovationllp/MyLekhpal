import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local before building.');
  if (key.startsWith('sb_secret_')) throw new Error('Use the public Supabase anon/publishable key, never a secret key.');
  if (key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon') {
    throw new Error('The browser Supabase key must have the anon role.');
  }
  return {
    plugins: [react()],
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    css: { postcss: { plugins: [tailwindcss()] } },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key),
    },
    build: { outDir: 'dist', emptyOutDir: true },
  };
});
