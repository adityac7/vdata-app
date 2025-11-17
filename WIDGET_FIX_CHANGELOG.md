# Widget Rendering Fix - Changelog

## Date: 2025-10-21

## Problem
The previous widget surface overwhelmed end users with analyst guardrails and repeated business rules, while the MCP server description still referred to outdated weight scaling (1 unit = 4,000 people). Operators asked for a cleaner UI and correct weighting guidance for downstream queries.

## Changes Made

### 1. Simplified the React widget layout
**File:** `web/src/component.tsx`

- Rebuilt the dashboard around a compact hero, three status cards, and a single results module so users only see live query context, tables, and history.
- Removed the instructional panels to keep the rendered content lightweight while preserving dark/light responsiveness and truncation messaging.

### 2. Updated tool guidance for weighting logic
**File:** `server/src/index.ts`

- Reworded the `run_query` tool description to spell out that each weight unit equals 1,000 people, population estimates must use `SUM(metric*weight*1000)`, and NCCS merging plus 2-year recency filters remain mandatory.
- Highlighted the FMCG ecommerce funnel, time defaults, and output expectations in a single concise paragraph so the MCP/LLM logic retains the guardrails without inflating the UI payload.

## Why These Fixes Work

1. **User-facing simplicity** – The widget now mirrors a modern KPI strip + table pattern, keeping the ChatGPT pane focused on answers rather than requirements.
2. **Correct analytics math** – Centralizing the 1,000-people weight rule in the MCP tool description ensures every generated SQL statement follows the proper scaling even though the UI no longer repeats it.

## Testing Checklist

- [x] Widget renders in ChatGPT UI
- [x] Tool calls still work correctly
- [x] Query results display in the widget
- [x] Row limits/truncation messaging still present
- [x] Theme switching works (light/dark)
- [x] Display mode changes work (inline/fullscreen)
- [x] Query history is tracked

## Date: 2025-10-20

## Problem
The blanket 5-row cap added for every MCP tool response prevented schema lookups and summaries from returning complete data, while still failing to remind the assistant to keep raw exports concise.

## Changes Made

### 1. Scope the Row Cap to Raw Data Exports Only
**File:** `server/src/index.ts`

- Introduced an explicit `RAW_DATA_EXPORT_ROW_CAP` that only applies to the `run_query` tool, keeping the "raw data export" path trimmed to the first five rows while allowing other helpers to return the full dataset they fetch.
- Updated the shared formatter so truncation messaging reflects the active limit rather than a hard-coded constant.

### 2. Restore Full Payloads for Supporting Tools
**File:** `server/src/index.ts`

- Removed artificial slicing from schema listings and statistical helpers so ChatGPT receives the entire result that PostgreSQL returns (still bounded by database-level LIMITs).
- Clarified tool descriptions to match the new behaviour and added guidance that raw exports should stay tightly scoped to avoid token blowups.

## Why These Fixes Work

1. **Preserves Necessary Context** – Schema and aggregate helpers now surface all requested rows, allowing the assistant to reason with complete metadata.
2. **Still Protects the Timeline** – Raw exports remain capped at five rows, satisfying the requirement without overloading ChatGPT with giant payloads.

## Testing Checklist

- [x] Widget renders in ChatGPT UI
- [x] Tool calls still work correctly
- [x] Query results display in the widget
- [x] Raw data exports show truncation messaging after five rows
- [x] Schema/statistics helpers return full result sets
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
