# Widget Rendering Fix - Changelog

## Date: 2025-10-19

## Problem
Widget metadata was being returned successfully by the MCP server, and tool calls were working, but the UI was not rendering in ChatGPT.

## Root Cause
The widget HTML was using external script loading (`<script src="...">`) instead of inline JavaScript, which is the required pattern for ChatGPT widgets.

## Changes Made

### 1. Inline JavaScript and CSS in Widget HTML
**File:** `server/src/index.ts` (lines 80-98)

**Before:**
```typescript
const WIDGET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; }
    #vdata-root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="vdata-root"></div>
  <script type="module" src="${BASE_URL}/assets/component.js"></script>
</body>
</html>
`.trim();
```

**After:**
```typescript
const WIDGET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; }
    #vdata-root { width: 100%; height: 100%; }
    ${COMPONENT_CSS}
  </style>
</head>
<body>
  <div id="vdata-root"></div>
  <script type="module">${COMPONENT_JS}</script>
</body>
</html>
`.trim();
```

**Impact:** Widget HTML is now self-contained with all JavaScript and CSS embedded inline, matching OpenAI's required pattern.

### 2. Clean Up CSP Configuration
**File:** `server/src/index.ts` (lines 108-111)

**Before:**
```typescript
"openai/widgetCSP": {
  connect_domains: DATABASE_URL ? [`https://${new URL(DATABASE_URL).hostname}`] : [],
  resource_domains: [BASE_URL]
},
```

**After:**
```typescript
"openai/widgetCSP": {
  connect_domains: [],  // No external API calls needed - widget uses window.openai
  resource_domains: []   // All assets inlined in HTML
},
```

**Impact:** 
- Removed Postgres hostname from `connect_domains` (browsers can't connect to Postgres directly)
- Removed `BASE_URL` from `resource_domains` (no longer needed since all assets are inlined)
- Widget now has minimal CSP footprint

## Why These Fixes Work

1. **Inline JavaScript is the Standard Pattern**
   - OpenAI documentation explicitly shows inline scripts
   - All official examples use `<script type="module">${JS_CODE}</script>`
   - ChatGPT's widget iframe expects self-contained HTML

2. **CSP Cleanup Follows Best Practices**
   - The React component doesn't make HTTP calls (uses `window.openai.toolOutput`)
   - No external resources are loaded
   - Postgres connection is server-side only

## Testing Checklist

- [ ] Widget renders in ChatGPT UI
- [ ] Tool calls still work correctly
- [ ] Query results display in the widget
- [ ] Theme switching works (light/dark)
- [ ] Display mode changes work (inline/fullscreen)
- [ ] Query history is tracked

## References

- OpenAI Custom UX Documentation: https://developers.openai.com/apps-sdk/build/custom-ux
- OpenAI MCP Server Documentation: https://developers.openai.com/apps-sdk/build/mcp-server
- OpenAI Examples Repository: https://github.com/openai/openai-apps-sdk-examples

## Notes

The `/assets/` route handler (lines 826-856) is still present in the code but is no longer used by the widget. It can be removed in a future cleanup if desired, but keeping it doesn't cause any issues.

