# Agent Guidelines

This document governs the entire repository. When editing any file, make sure the change respects the conventions below so subsequent agents understand the system and the ChatGPT widget keeps working.

## Project overview
- The app implements an MCP server (`server/`) that exposes SQL tools and serves the ChatGPT widget UI.
- The widget itself is a React/TypeScript bundle (`web/`) that renders database results and persists lightweight state via `window.openai` hooks.
- Documentation under the repo root (`README.md`, `IMPLEMENTATION_GUIDE.md`, `WIDGET_FIX_CHANGELOG.md`, etc.) explains how to deploy on Render and how the widget evolved—update these docs when behaviour changes.

## Directory map
- `server/`: TypeScript sources compiled to `server/dist`. Handles MCP transport, HTTP endpoints, widget metadata, and database access.
- `server/src/widget-assets.ts`: The single authority for locating/building widget bundles. Extend this helper instead of sprinkling asset logic elsewhere.
- `server/src/database.ts`: All PostgreSQL access helpers and safety checks. Keep SQL validation here.
- `web/`: React widget source plus its esbuild-based build pipeline (`web/build.js`). The produced assets land in `web/dist`.
- `render.yaml`: Render deployment definition—adjust carefully when changing ports or startup commands.
- `web/dist/`: Generated output. Never hand-edit; only produced via the web build.

## Build & test workflow
- Install dependencies where needed: `npm --prefix server install` for the server, `npm --prefix web install` for the widget.
- Compile server TypeScript before running locally: `npm --prefix server run build` followed by `node server/dist/index.js`.
- Always build the widget when modifying anything under `web/`: `npm --prefix web run build`. Keep `web/dist` committed and in sync with source edits.
- If you touch both halves, rebuild both and sanity-check that the HTTP server starts without errors.

## Coding conventions
- Preserve existing behaviour; make only the minimal, well-reasoned changes required to satisfy a request.
- Use TypeScript with ES modules and top-level `await` where it simplifies boot sequences.
- Prefer additive, well-logged changes over rewrites; logging should stay actionable and concise.
- Avoid introducing silent fallbacks—surface actionable console warnings when behaviour differs from the happy path.
- Do not add try/catch around import statements.

## Server-specific guidance (`server/`)
- Route all widget asset loading through `loadWidgetAssets` in `server/src/widget-assets.ts`. If behaviour must change (e.g., caching, additional asset types), extend that module.
- Derive widget metadata (origins, CSP domains) from runtime configuration such as `BASE_URL`/`RENDER_EXTERNAL_URL`; never hard-code ChatGPT or localhost origins.
- When adding tools, include descriptive `_meta` annotations so ChatGPT knows widgets are available.
- Keep HTTP handlers fast and deterministic—long-running work belongs in async helpers invoked by the tools, not the request loop.

## Widget guidance (`web/`)
- Follow the existing functional React style with hooks (`useWidgetProps`, `useWidgetState`, `useOpenAiGlobal`).
- Inline styles are intentional to simplify sandboxed delivery; if you introduce CSS files, ensure the build script emits them to `web/dist` and update `widget-assets.ts` accordingly.
- The widget must remain self-contained; do not fetch third-party assets or fonts.

## Documentation expectations
- Update `WIDGET_FIX_CHANGELOG.md` when the widget delivery pipeline or UI behaviour changes.
- `IMPLEMENTATION_GUIDE.md` should reflect the current local-development workflow; revise when altering startup commands.
- Keep `FIXES_SUMMARY.md` coherent with recent fixes so operators can audit what shipped.

Follow these rules to avoid regressions and keep the ChatGPT UI rendering correctly.
