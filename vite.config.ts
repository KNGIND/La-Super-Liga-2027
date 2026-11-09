import { defineConfig, type Plugin } from 'vite';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const VERSION = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

/** Genera dist/sw.js con la lista real de archivos compilados (para que funcione offline). */
function swPlugin(): Plugin {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  return {
    name: 'lsl-service-worker',
    apply: 'build',
    closeBundle() {
      const out = 'dist';
      const files = walk(out)
        .map((p) => relative(out, p).replace(/\\/g, '/'))
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.startsWith('rive/'));
      const tpl = readFileSync('src/sw-template.js', 'utf8');
      const code = tpl.replace('__VERSION__', VERSION).replace('__PRECACHE__', JSON.stringify(files));
      writeFileSync(join(out, 'sw.js'), code);
    },
  };
}

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  base: './', // rutas relativas: funciona en Vercel, GitHub Pages, Capacitor y subcarpetas
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 300 },
  plugins: [swPlugin()],
});
