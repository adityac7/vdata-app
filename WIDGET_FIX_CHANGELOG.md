# Widget Rendering Fix - Changelog

## Date: 2025-10-19

## Problem
Widget metadata was being returned successfully by the MCP server, and tool calls were working, but the UI was not rendering in ChatGPT.

## Root Cause
The widget HTML was being delivered without a reliable way to ensure the compiled React bundle existed at runtime. When the `web/dist` assets were missing, ChatGPT received fallback HTML and never mounted the UI.

## Changes Made

### 1. Centralize Widget Asset Loading
**Files:** `server/src/index.ts`, `server/src/widget-assets.ts`

- Added `widget-assets.ts` to encapsulate locating or building the compiled widget. The helper checks for `web/dist` outputs, runs an on-demand esbuild compile when necessary, and exposes the HTML shell plus referenced scripts and styles.
- Updated `index.ts` to import the helper so the MCP resource response and the `/assets` static handler both share the same asset manifest.

### 2. Derive Widget Metadata from Deployment Configuration
**File:** `server/src/index.ts`

- Replaced hard-coded origins with values derived from `BASE_URL`, keeping `openai/widgetDomain` and CSP declarations consistent with the server environment.

### 3. Preserve a Clear Fallback Path
**Files:** `server/src/widget-assets.ts`, `server/src/index.ts`

- When the bundle cannot be built, the helper now returns explicit placeholder HTML so the issue is visible in ChatGPT instead of failing silently.

### 4. Align Widget Delivery with ChatGPT Sandbox Expectations
**Files:** `server/src/index.ts`, `web/src/component.tsx`

- Switched widget assets to use relative `/assets/` paths and omit an invalid `openai/widgetDomain` when the configured base URL mistakenly points at `chatgpt.com`, ensuring ChatGPT pulls scripts from the MCP server instead of itself.
- Added a hard cap of five rows for every tool response, including schema listings, with UI messaging that highlights when data is truncated so operators know to refine queries.
- Extended schema fetching to use parameter binding and clarified tool descriptions so ChatGPT's semantic layer understands the row limits and avoids requesting overly broad results.

## Why These Fixes Work

1. **Matches Apps SDK Patterns** – Serving static assets through `/assets` mirrors the official examples, allowing ChatGPT to fetch the React bundle exactly where metadata says it lives.
2. **Configuration-Driven Metadata** – Aligning widget metadata with `BASE_URL` avoids sandbox mismatches when deploying to different hosts.
3. **Single Source of Truth** – By routing all asset logic through `widget-assets.ts`, future changes only need to touch one module, reducing the risk of regressions.

## Testing Checklist

- [x] Widget renders in ChatGPT UI
- [x] Tool calls still work correctly
- [x] Query results display in the widget
- [x] Row limits enforced (5 rows shown, message indicates truncation)
- [x] Theme switching works (light/dark)
- [x] Display mode changes work (inline/fullscreen)
- [x] Query history is tracked

## References

- OpenAI Custom UX Documentation: https://developers.openai.com/apps-sdk/build/custom-ux
- OpenAI MCP Server Documentation: https://developers.openai.com/apps-sdk/build/mcp-server
- OpenAI Examples Repository: https://github.com/openai/openai-apps-sdk-examples

## Notes

- Extend `widget-assets.ts` if the build process needs to change—do not reimplement the loader elsewhere.
- The `/assets/` route now serves the compiled bundle referenced by widget metadata and should remain enabled.
