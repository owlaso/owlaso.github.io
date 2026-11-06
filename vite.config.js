import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const page = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: '.',
  // Absolute asset URLs so 404.html works at any nested GitHub Pages path.
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: page('./index.html'),
        docs: page('./docs/index.html'),
        security: page('./security/index.html'),
        notFound: page('./404.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
