import { access, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WEB_DIR = join(__dirname, "../../web");
const DIST_DIR = join(WEB_DIR, "dist");
const JS_FILENAME = "component.js";
const CSS_FILENAME = "component.css";

function placeholderAssets() {
  return {
    js: `
      console.log("Vdata App loaded (placeholder)");
      const root = document.getElementById("vdata-root");
      if (root) {
        root.innerHTML = '<div style="padding: 20px; font-family: system-ui;"><h1>🎉 Vdata Analytics</h1><p>UI component not built. Run: cd web && npm run build</p></div>';
      }
    `,
    css: `
      body { margin: 0; padding: 0; }
      #vdata-root { font-family: system-ui, -apple-system, sans-serif; }
    `,
    placeholder: true as const,
  };
}

async function fileExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureBuiltAssets() {
  const jsPath = join(DIST_DIR, JS_FILENAME);
  const cssPath = join(DIST_DIR, CSS_FILENAME);
  const [hasJs, hasCss] = await Promise.all([fileExists(jsPath), fileExists(cssPath)]);

  if (hasJs && hasCss) {
    return;
  }

  console.warn("⚠️  Widget assets missing - running build via esbuild");

  const esbuild = await import("esbuild");

  await mkdir(DIST_DIR, { recursive: true });

  await esbuild.build({
    entryPoints: [join(WEB_DIR, "src/component.tsx")],
    bundle: true,
    format: "esm",
    outfile: jsPath,
    jsx: "automatic",
    minify: true,
    sourcemap: false,
    target: "es2020",
    platform: "browser",
    absWorkingDir: WEB_DIR,
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    logLevel: "warning",
  });

  await esbuild.build({
    stdin: {
      contents: `
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        #vdata-root { width: 100%; height: 100%; }
      `,
      loader: "css",
      resolveDir: WEB_DIR,
    },
    outfile: cssPath,
    minify: true,
    sourcemap: false,
    logLevel: "warning",
  });

  console.log("✅ Widget assets built via esbuild");
}

export async function loadWidgetAssets() {
  try {
    await ensureBuiltAssets();
    const [js, css] = await Promise.all([
      readFile(join(DIST_DIR, JS_FILENAME), "utf8"),
      readFile(join(DIST_DIR, CSS_FILENAME), "utf8"),
    ]);

    return { js, css, placeholder: false as const };
  } catch (error) {
    console.error("Failed to load widget assets:", error);
    return placeholderAssets();
  }
}
