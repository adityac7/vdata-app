# Vdata App - Implementation Guide

## Changes Made (Following OpenAI Apps SDK Documentation)

### Phase 1: React Component & Hooks ✅

Created proper OpenAI bridge hooks (based on official examples):

1. **`web/src/types.ts`** - TypeScript definitions for `window.openai` API
2. **`web/src/use-openai-global.ts`** - Subscribe to OpenAI context changes
3. **`web/src/use-widget-props.ts`** - Access tool output data
4. **`web/src/use-widget-state.ts`** - Persistent widget state management

5. **`web/src/component.tsx`** - Completely rewritten dashboard with:
   - Proper hooks usage (`useWidgetProps`, `useWidgetState`, `useOpenAiGlobal`)
   - Theme support (dark/light)
   - Display mode support (inline/fullscreen)
   - Query results table with sticky headers
   - Query history tracking
   - Status indicators with animations
   - Error handling
   - Execution time display

### Phase 2: Build Configuration ✅

Updated **`web/build.js`**:
- Added source maps for debugging
- Configured for iframe isolation
- Set production environment variables
- Improved logging

### Phase 3: PostgreSQL Integration ✅

Completely rewrote **`server/src/index.ts`** with:

#### Multiple Tools (Following MCP Pattern):
1. **`initialize_dashboard`** - Shows analytics UI with database status
2. **`run_query`** - Executes SELECT queries on PostgreSQL
3. **`get_schema`** - Lists all tables or describes specific table

#### PostgreSQL Features:
- Connection pooling with error handling
- SSL support for Render PostgreSQL
- Graceful degradation when DATABASE_URL not set
- Query execution with timing
- Proper error responses
- Connection cleanup on shutdown

#### Metadata Structure (Following OpenAI Docs):
- `openai/outputTemplate` - Links to widget HTML
- `openai/toolInvocation/invoking` - Status during execution
- `openai/toolInvocation/invoked` - Completion status
- `openai/widgetAccessible` - Widget availability
- `openai/resultCanProduceWidget` - Widget capability
- `openai/widgetPrefersBorder` - UI preference
- `openai/widgetDomain` - Security domain
- `openai/widgetCSP` - Content Security Policy with database domain

### Phase 4: Deployment Configuration ✅

Updated **`render.yaml`**:
- Added `DATABASE_URL` environment variable (to be set in Render dashboard)

---

## How It Works Now

### Correct Flow (As Per OpenAI Documentation):

```
User asks: "Show me all users"
    ↓
ChatGPT routes to Vdata App
    ↓
Model calls: run_query(query="SELECT * FROM users LIMIT 100")
    ↓
Server executes query on PostgreSQL
    ↓
Server returns:
    {
      content: [{ type: "text", text: "Query executed successfully..." }],
      structuredContent: {
        query: "SELECT * FROM users LIMIT 100",
        results: [...],
        columns: ["id", "name", "email"],
        status: "success",
        executionTime: 45
      },
      _meta: { "openai/outputTemplate": "ui://vdata/analytics-dashboard.html" }
    }
    ↓
ChatGPT renders widget with structured data
    ↓
Dashboard displays:
    - Query SQL in code block
    - Results in scrollable table
    - Row count and execution time
    - Query added to history
    ↓
User asks follow-up: "Show me users created this week"
    ↓
Model calls run_query again with new SQL
    ↓
Same dashboard updates with new data
    ↓
Query history shows both queries
```

### Multi-Step Interaction:

1. **Initial Request**: User asks about data
2. **Dashboard Loads**: Widget shows with query results
3. **Follow-up Queries**: New tool calls update the same dashboard
4. **State Persists**: Query history maintained via `useWidgetState`
5. **Theme Adapts**: Dashboard respects ChatGPT's theme (light/dark)
6. **Display Modes**: Supports both inline and fullscreen viewing

---

## Deployment Instructions

### Step 1: Install Dependencies Locally

```bash
cd /Users/admin_vtion/Desktop/app/vdata-app

# Install web dependencies
cd web
npm install

# Install server dependencies
cd ../server
npm install
```

### Step 2: Build Locally (Test)

```bash
# Build web component
cd web
npm run build
# Should create: web/dist/component.js and web/dist/component.css

# Build server
cd ../server
npm run build
# Should create: server/dist/index.js
```

### Step 3: Test Locally (Optional)

```bash
# Set DATABASE_URL (use your Render PostgreSQL URL)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Start server
cd server
npm start

# Test in another terminal:
curl http://localhost:8000/health
# Should return: {"status":"ok","database":"connected"}

curl http://localhost:8000/
# Should list all tools
```

### Step 4: Deploy to Render

#### Option A: Via GitHub (Recommended)

```bash
# From project root
cd /Users/admin_vtion/Desktop/app/vdata-app

# Initialize git (if not already done)
git init
git add .
git commit -m "feat: Complete OpenAI Apps SDK implementation with PostgreSQL"

# Push to GitHub
git remote add origin https://github.com/adityac7/vdata-app.git
git branch -M main
git push -u origin main
```

Then in Render Dashboard:
1. Go to https://render.com/dashboard
2. Click "New +" → "Web Service"
3. Connect to your GitHub repo `vdata-app`
4. Render will auto-detect `render.yaml`
5. Click "Apply"

#### Option B: Manual Configuration

If Render doesn't auto-detect:

1. Create new Web Service
2. Connect repository: `adityac7/vdata-app`
3. Settings:
   - **Name**: `vdata-app`
   - **Runtime**: Node
   - **Build Command**:
     ```
     cd web && npm install && npm run build && cd ../server && npm install && npm run build
     ```
   - **Start Command**:
     ```
     cd server && node dist/index.js
     ```
   - **Plan**: Free

### Step 5: Configure Environment Variables in Render

After deployment starts, go to your service's "Environment" tab:

1. Add `DATABASE_URL`:
   - **Key**: `DATABASE_URL`
   - **Value**: Your PostgreSQL connection string
     ```
     postgresql://username:password@host:port/database?sslmode=require
     ```
     (This is the same DATABASE_URL you're using in your mcp-analytics-server)

2. Other variables (should be auto-set from render.yaml):
   - `NODE_ENV=production`
   - `PORT=10000`

3. Click "Save Changes"
4. Render will redeploy automatically

### Step 6: Verify Deployment

Once deployed, test your endpoints:

```bash
# Replace with your Render URL
RENDER_URL="https://vdata-app.onrender.com"

# Health check
curl $RENDER_URL/health
# Expected: {"status":"ok","database":"connected"}

# Server info
curl $RENDER_URL/
# Expected: Lists server name, version, tools

# MCP endpoint (should initiate SSE connection)
curl $RENDER_URL/mcp
```

### Step 7: Connect to ChatGPT

1. Open ChatGPT (https://chatgpt.com)
2. Click on your profile → **Settings**
3. Go to **Connectors** section
4. Enable **Developer Mode** (if not already enabled)
5. Click **"Add Connector"**
6. Enter your MCP endpoint:
   ```
   https://vdata-app.onrender.com/mcp
   ```
7. Click **"Add"** or **"Connect"**
8. Wait for connection confirmation

### Step 8: Test in ChatGPT

Try these prompts:

1. **Initialize Dashboard**:
   ```
   Show me the Vdata analytics dashboard
   ```
   Expected: Dashboard loads with connection status

2. **List Tables**:
   ```
   What tables are in my database?
   ```
   Expected: Table listing displayed in dashboard

3. **Run Query**:
   ```
   Show me all records from the users table
   ```
   Expected: Query executes, results displayed in table

4. **Follow-up Query**:
   ```
   Now show me only users created in the last 7 days
   ```
   Expected: New query executes, same dashboard updates

5. **Get Schema**:
   ```
   What are the columns in the users table?
   ```
   Expected: Schema information displayed

---

## Troubleshooting

### Issue: UI Not Rendering

**Symptoms**: No widget appears in ChatGPT, only text responses

**Solutions**:
1. Check browser console (F12) for errors
2. Verify `web/dist/component.js` exists and was built
3. Check Render logs for "Loaded component.js" message
4. Ensure `mimeType: "text/html+skybridge"` is set correctly
5. Verify metadata includes `"openai/outputTemplate"`

### Issue: Database Not Connected

**Symptoms**: "Database not connected" error in dashboard

**Solutions**:
1. Verify `DATABASE_URL` is set in Render environment variables
2. Check format: `postgresql://user:pass@host:port/db?sslmode=require`
3. Test connection string with `psql` or database client
4. Check Render logs for PostgreSQL connection errors
5. Ensure your PostgreSQL service is running

### Issue: Queries Failing

**Symptoms**: "Query failed" error in dashboard

**Solutions**:
1. Check SQL syntax
2. Verify table/column names exist
3. Check Render logs for detailed error messages
4. Ensure user has SELECT permissions
5. Try simple query first: `SELECT 1`

### Issue: Dashboard Shows Old Data

**Symptoms**: New queries don't update the UI

**Solutions**:
1. This shouldn't happen with proper hooks implementation
2. Check if `useWidgetProps()` is being used correctly
3. Verify tool response includes `structuredContent`
4. Clear ChatGPT cache/refresh page
5. Check if multiple widgets are mounted (should only be one)

### Issue: Theme Not Working

**Symptoms**: Dashboard ignores ChatGPT theme

**Solutions**:
1. Verify `useOpenAiGlobal('theme')` is called
2. Check if `window.openai.theme` is available
3. Fallback to light theme if undefined
4. Test theme toggle in ChatGPT settings

---

## Key Differences from Before

| Aspect | Old Implementation | New Implementation |
|--------|-------------------|-------------------|
| **React Hooks** | Direct `window.openai` access | Proper hooks with subscriptions |
| **UI Updates** | Static/manual | Reactive to tool outputs |
| **Tool Count** | 1 (show_vdata_app) | 3 (initialize, run_query, get_schema) |
| **Database** | None | PostgreSQL with connection pooling |
| **Metadata** | Minimal | Complete OpenAI spec compliance |
| **CSP** | Empty | Includes database domain |
| **State Management** | Local only | Synced with server via hooks |
| **Theme Support** | None | Light/dark auto-adapts |
| **Error Handling** | Basic | Comprehensive with UI feedback |
| **Query History** | None | Persistent across calls |

---

## Next Steps

Once deployed and working:

1. **Add More Tools**:
   - `execute_aggregation` - COUNT, SUM, AVG queries
   - `get_table_preview` - Quick preview with sampling
   - `export_results` - Download as CSV/JSON

2. **Enhanced UI**:
   - Charts/visualizations (using a charting library)
   - Query builder interface
   - Column sorting and filtering
   - Export buttons

3. **Performance**:
   - Query result caching
   - Pagination for large results
   - Query cancellation

4. **Security**:
   - SQL injection prevention (use parameterized queries)
   - Query whitelisting
   - Row-level security

---

## Files Changed Summary

```
vdata-app/
├── web/
│   ├── src/
│   │   ├── component.tsx         ✅ REWRITTEN - Dashboard with proper hooks
│   │   ├── types.ts              ✅ NEW - OpenAI API types
│   │   ├── use-openai-global.ts  ✅ NEW - Context subscription hook
│   │   ├── use-widget-props.ts   ✅ NEW - Tool output hook
│   │   └── use-widget-state.ts   ✅ NEW - Persistent state hook
│   ├── build.js                  ✅ UPDATED - Better bundling config
│   └── package.json              (no changes)
│
├── server/
│   ├── src/
│   │   └── index.ts              ✅ COMPLETELY REWRITTEN - PostgreSQL + 3 tools
│   ├── package.json              ✅ UPDATED - Added pg, @types/pg
│   └── tsconfig.json             (no changes)
│
├── render.yaml                   ✅ UPDATED - Added DATABASE_URL
├── IMPLEMENTATION_GUIDE.md       ✅ NEW - This file
└── README.md                     (keep existing)
```

---

## References

- [OpenAI Apps SDK Documentation](https://developers.openai.com/apps-sdk/)
- [MCP Server Setup](https://developers.openai.com/apps-sdk/build/mcp-server/)
- [Custom UX Guide](https://developers.openai.com/apps-sdk/build/custom-ux/)
- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

## Support

If issues persist:
1. Check Render deployment logs
2. Test MCP endpoint with curl
3. Inspect browser console in ChatGPT
4. Verify PostgreSQL connection separately
5. Compare with OpenAI SDK examples

Good luck with your deployment! 🚀
