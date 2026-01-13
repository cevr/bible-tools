import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import solidTransformPlugin from '@opentui/solid/bun-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

console.log('Building Bible CLI...');

const binDir = join(rootDir, 'bin');
mkdirSync(binDir, { recursive: true });

// Single-step build: transform JSX + bundle + compile to binary
// Note: Run from a directory without bunfig.toml to avoid preload being embedded
console.log('Transforming Solid JSX, bundling, and compiling to binary...');
const buildResult = await Bun.build({
  entrypoints: [join(rootDir, 'src/main.ts')],
  target: 'bun',
  plugins: [solidTransformPlugin],
  minify: false, // Keep readable for debugging if needed
  compile: {
    target: 'bun-darwin-arm64',
    outfile: join(binDir, 'bible'),
  },
});

if (!buildResult.success) {
  console.error('Build failed:');
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`✅ Binary built: ${join(binDir, 'bible')}`);

// Copy to node_modules/.bin for convenience
const nodeModulesBin = join(rootDir, 'node_modules/.bin/bible');
await Bun.$`cp ${join(binDir, 'bible')} ${nodeModulesBin}`;
console.log(`✅ Copied to: ${nodeModulesBin}`);
