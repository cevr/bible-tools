import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, rmSync } from "fs";
import solidTransformPlugin from "@opentui/solid/bun-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

console.log("Building Bible CLI...");

const binDir = join(rootDir, "bin");
const tmpDir = join(rootDir, ".build-tmp");

// Clean directories
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });
mkdirSync(binDir, { recursive: true });

// Step 1: Transform JSX with Solid plugin and bundle to a single file
console.log("Step 1: Transforming Solid JSX and bundling...");
const bundleResult = await Bun.build({
  entrypoints: [join(rootDir, "src/main.ts")],
  target: "bun",
  outdir: tmpDir,
  plugins: [solidTransformPlugin],
  minify: false, // Keep readable for debugging if needed
});

if (!bundleResult.success) {
  console.error("Bundle failed:");
  for (const log of bundleResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Bundle complete.");

// Step 2: Compile the bundled JS to a binary
console.log("Step 2: Compiling to binary...");
const compileResult = await Bun.build({
  entrypoints: [join(tmpDir, "main.js")],
  compile: {
    target: "bun-darwin-arm64",
    outfile: join(binDir, "bible"),
  },
});

if (!compileResult.success) {
  console.error("Compile failed:");
  for (const log of compileResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Clean up temp directory
rmSync(tmpDir, { recursive: true, force: true });

console.log(`✅ Binary built: ${join(binDir, "bible")}`);

// Copy to node_modules/.bin for convenience
const nodeModulesBin = join(rootDir, "node_modules/.bin/bible");
await Bun.$`cp ${join(binDir, "bible")} ${nodeModulesBin}`;
console.log(`✅ Copied to: ${nodeModulesBin}`);
