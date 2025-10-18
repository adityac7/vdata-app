import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';

// Ensure dist directory exists
await mkdir('dist', { recursive: true });

// Build the component
await esbuild.build({
  entryPoints: ['src/component.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/component.js',
  jsx: 'automatic',
  minify: true,
  target: 'es2020',
  platform: 'browser',
  external: []
});

// Create a minimal CSS file
await esbuild.build({
  stdin: {
    contents: `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
    `,
    loader: 'css'
  },
  outfile: 'dist/component.css',
  minify: true
});

console.log('✅ Build complete!');

