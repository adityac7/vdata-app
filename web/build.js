import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';

// Ensure dist directory exists
await mkdir('dist', { recursive: true });

// Build the component
// Following OpenAI Apps SDK examples pattern
await esbuild.build({
  entryPoints: ['src/component.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/component.js',
  jsx: 'automatic',
  minify: true,
  sourcemap: true, // Add source maps for debugging
  target: 'es2020',
  platform: 'browser',
  // Don't externalize anything - bundle all dependencies
  // This is important for iframe isolation
  external: [],
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
});

// Create a minimal CSS file
await esbuild.build({
  stdin: {
    contents: `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
      #vdata-root { width: 100%; height: 100%; }
    `,
    loader: 'css'
  },
  outfile: 'dist/component.css',
  minify: true,
  sourcemap: true,
});

console.log('✅ Build complete!');

