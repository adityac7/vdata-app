#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { URL } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListResourcesRequest,
  type ReadResourceRequest,
  type ListToolsRequest,
  type Resource,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  executeQuery,
  getDatabaseSchema,
  getSampleData,
  getDatabaseStatistics,
  getColumnValueCounts,
  closePool
} from "./database.js";
import { loadWidgetAssets } from "./widget-assets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port and database URL from environment
const PORT = parseInt(process.env.PORT || "8000", 10);
const DATABASE_URL = process.env.DATABASE_URL;
// Use Render's auto-provided RENDER_EXTERNAL_URL first, then BASE_URL, then localhost
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
const BASE_ORIGIN = (() => {
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return BASE_URL;
  }
})();

// Check if database is configured
const isDatabaseConfigured = !!DATABASE_URL;

if (isDatabaseConfigured) {
  console.log('✅ DATABASE_URL configured');
} else {
  console.warn('⚠️  DATABASE_URL not set - database tools will not work');
}

// Load the built React component (building on-demand if needed)
const {
  js: COMPONENT_JS,
  css: COMPONENT_CSS,
  placeholder: COMPONENT_PLACEHOLDER,
} = await loadWidgetAssets();

if (COMPONENT_PLACEHOLDER) {
  console.warn("⚠️  Using placeholder widget assets. The React UI will not render.");
} else {
  console.log("✅ Widget assets ready");
}

// Widget configuration
const WIDGET_URI = "ui://vdata/analytics-dashboard.html";
const assetBasePath = "/assets/";
const widgetStylesheetHref = `${assetBasePath}component.css`;
const widgetScriptSrc = `${assetBasePath}component.js`;

const widgetDomain = (() => {
  if (!BASE_ORIGIN) {
    return undefined;
  }

  if (BASE_ORIGIN.includes("chatgpt.com")) {
    console.warn(
      "⚠️  BASE_URL/RENDER_EXTERNAL_URL resolves to chatgpt.com. " +
        "Widget domain metadata will be omitted so ChatGPT falls back to the resource origin."
    );
    return undefined;
  }

  return BASE_ORIGIN;
})();

// Always inline the assets for maximum compatibility
// This is the recommended approach per OpenAI Apps SDK documentation
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

const RAW_DATA_EXPORT_ROW_CAP = 5;

// Helper function to create widget metadata
function widgetMeta(additionalMeta: Record<string, any> = {}) {
  const { "openai/widgetCSP": additionalCsp, ...restMeta } = additionalMeta;

  const meta: Record<string, any> = {
    "openai/outputTemplate": WIDGET_URI,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      // No external connections needed - all assets are inlined
      connect_domains: [],
      // No external resources needed - all assets are inlined
      resource_domains: [],
      ...(additionalCsp ?? {}),
    },
    ...restMeta,
  };

  // Don't set widgetDomain since we're inlining all assets
  // This avoids subdomain sandbox complexity

  return meta;
}

// Define resources
const resources: Resource[] = [
  {
    uri: WIDGET_URI,
    name: "Vdata Analytics Dashboard",
    description: "Interactive analytics dashboard for PostgreSQL data",
    mimeType: "text/html+skybridge",
    _meta: widgetMeta()  // CSP already included in widgetMeta() function
  }
];

// Tool input schemas
const runQuerySchema = z.object({
  query: z.string().describe("SQL SELECT query to execute"),
  limit: z.number().optional().describe("Optional limit for results (default: 1000)")
});

const getSchemaSchema = z.object({
  tableName: z.string().optional().describe("Optional: specific table name. Leave empty to list all tables")
});

const initializeDashboardSchema = z.object({
  message: z.string().optional().describe("Optional welcome message")
});

const getSampleDataSchema = z.object({
  limit: z.number().optional().describe("Number of sample rows to return (default: 10, max: 100)")
});

const getDatabaseStatisticsSchema = z.object({});

const getColumnValueCountsSchema = z.object({
  columnName: z.string().describe("Column name to analyze. Valid columns: type, cat, genre, age_bucket, gender, nccs_class, state_grp, day_of_week, population, app_name"),
  limit: z.number().optional().describe("Number of top values to return (default: 20, max: 100)")
});

// Define tools - following OpenAI Apps SDK pattern
const tools: Tool[] = [
  // Compatibility alias for old tool name
  {
    name: "show_vdata_app",
    description: "Display the Vdata App interface with a welcome message (alias for initialize_dashboard)",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional welcome message"
        }
      },
      additionalProperties: false
    },
    title: "Show Vdata App",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Loading Vdata App...",
      "openai/toolInvocation/invoked": "Vdata App loaded",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "initialize_dashboard",
    description: "Initialize the analytics dashboard and show database connection status",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional welcome message"
        }
      },
      additionalProperties: false
    },
    title: "Initialize Dashboard",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Loading dashboard...",
      "openai/toolInvocation/invoked": "Dashboard ready",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "run_query",
    description: "Execute a SELECT query on the PostgreSQL database (digital_insights table) and display results in the analytics dashboard. Treat this as the raw data export path—the response only renders the first 5 rows in ChatGPT to keep replies lightweight. IMPORTANT: The table has these key columns: type, cat, genre, age_bucket, gender, nccs_class, state_grp, day_of_week, population, app_name, duration_sum (NOT 'duration'), event_id, user_id. Always use 'duration_sum' for duration-related queries and keep queries tightly scoped to avoid unnecessary tokens.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute. Use 'duration_sum' for duration, not 'duration'."
        },
        limit: {
          type: "number",
          description: "Optional limit for results (default: 1000)"
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    title: "Run SQL Query",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Executing query...",
      "openai/toolInvocation/invoked": "Query executed",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "get_schema",
    description: "Get database schema information. If tableName is provided, returns column details for that table (showing up to 5 entries). Otherwise, lists all tables in the database (first 5 only).",
    inputSchema: {
      type: "object",
      properties: {
        tableName: {
          type: "string",
          description: "Optional: specific table name (e.g., 'digital_insights'). Leave empty to list all tables"
        }
      },
      additionalProperties: false
    },
    title: "Get Database Schema",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Fetching schema...",
      "openai/toolInvocation/invoked": "Schema retrieved",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "get_sample_data",
    description: "Get a sample of rows from the digital_insights table to preview the data structure and content. The dashboard will display every row returned by this helper.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of sample rows (default: 10, max: 100)"
        }
      },
      additionalProperties: false
    },
    title: "Get Sample Data",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Fetching sample data...",
      "openai/toolInvocation/invoked": "Sample data retrieved",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "get_database_statistics",
    description: "Get statistics about the digital_insights table including total row count and platform distribution (type, count, avg duration, percentage).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    title: "Get Database Statistics",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Calculating statistics...",
      "openai/toolInvocation/invoked": "Statistics retrieved",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  },
  {
    name: "get_column_value_counts",
    description: "Get value distribution for a specific column in the digital_insights table. Shows count and percentage for each unique value (up to the requested limit).",
    inputSchema: {
      type: "object",
      properties: {
        columnName: {
          type: "string",
          description: "Column name to analyze. Valid: type, cat, genre, age_bucket, gender, nccs_class, state_grp, day_of_week, population, app_name"
        },
        limit: {
          type: "number",
          description: "Number of top values to return (default: 20, max: 100)"
        }
      },
      required: ["columnName"],
      additionalProperties: false
    },
    title: "Get Column Value Counts",
    _meta: widgetMeta({
      "openai/toolInvocation/invoking": "Analyzing column...",
      "openai/toolInvocation/invoked": "Analysis complete",
    }),
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  }
];

// Helper to format database.ts results for dashboard
type FormatResultOptions = {
  displayLimit?: number;
};

function formatDatabaseResult(dbResult: any, query?: string, options: FormatResultOptions = {}): any {
  const { displayLimit } = options;

  const limitRows = (rows?: any[]) => {
    if (!Array.isArray(rows)) {
      return { rows: [], truncated: false };
    }

    if (typeof displayLimit === "number") {
      const limited = rows.slice(0, displayLimit);
      return {
        rows: limited,
        truncated: rows.length > limited.length,
      };
    }

    return {
      rows,
      truncated: false,
    };
  };

  const appendTruncationMessage = (message: string | undefined, truncated: boolean, totalRows: number) => {
    if (!truncated) {
      return message;
    }

    const shownCount = typeof displayLimit === 'number' ? displayLimit : totalRows;
    const note = `Showing first ${shownCount} of ${totalRows} rows.`;
    return message ? `${message.trim()} ${note}` : note;
  };

  const prepareResult = (params: {
    queryLabel: string;
    rows?: any[];
    columns?: string[];
    rowCount?: number;
    status: 'success' | 'error';
    message?: string;
    error?: string;
  }) => {
    const safeRows = Array.isArray(params.rows) ? params.rows : [];
    const { rows: limitedRows, truncated } = limitRows(safeRows);
    const inferredColumns = Array.isArray(params.columns) && params.columns.length > 0
      ? params.columns
      : limitedRows.length > 0
        ? Object.keys(limitedRows[0])
        : [];
    const totalRows = typeof params.rowCount === 'number'
      ? params.rowCount
      : safeRows.length;
    const effectiveDisplayLimit = typeof displayLimit === 'number'
      ? displayLimit
      : totalRows;

    return {
      query: params.queryLabel,
      results: limitedRows,
      columns: inferredColumns,
      rowCount: totalRows,
      status: params.status,
      error: params.error,
      message: params.status === 'success'
        ? appendTruncationMessage(params.message, truncated, totalRows)
        : params.message,
      truncated,
      displayLimit: effectiveDisplayLimit,
    };
  };

  const asRowArray = (value: any) => {
    if (Array.isArray(value) && (value.length === 0 || typeof value[0] === 'object')) {
      return value;
    }
    return undefined;
  };

  const asStringArray = (value: any) => {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value;
    }
    return undefined;
  };

  if (typeof dbResult === 'string') {
    try {
      const parsed = JSON.parse(dbResult);

      const rowData =
        asRowArray(parsed.data) ||
        asRowArray(parsed.rows) ||
        asRowArray(parsed.results) ||
        asRowArray(parsed.platforms) ||
        asRowArray(parsed.distribution) ||
        asRowArray(parsed.columns) ||
        [];

      const columnList =
        asStringArray(parsed.columns) ||
        (rowData.length > 0 ? Object.keys(rowData[0]) : []);

      const totalRows =
        typeof parsed.row_count === 'number'
          ? parsed.row_count
          : typeof parsed.sample_size === 'number'
            ? parsed.sample_size
            : typeof parsed.unique_values === 'number'
              ? parsed.unique_values
              : typeof parsed.total_rows === 'number'
                ? parsed.total_rows
                : rowData.length;

      return prepareResult({
        queryLabel: query || parsed.query || 'N/A',
        rows: rowData,
        columns: columnList,
        rowCount: totalRows,
        status: 'success',
        message: parsed.message || 'Query completed successfully',
      });
    } catch (e) {
      if (dbResult.startsWith('Error:')) {
        return prepareResult({
          queryLabel: query || 'N/A',
          rows: [],
          columns: [],
          rowCount: 0,
          status: 'error',
          error: dbResult.replace('Error: ', ''),
          message: dbResult,
        });
      }

      return prepareResult({
        queryLabel: query || 'N/A',
        rows: [],
        columns: [],
        rowCount: 0,
        status: 'success',
        message: dbResult,
      });
    }
  }

  if (dbResult.success !== undefined) {
    if (dbResult.success) {
      return prepareResult({
        queryLabel: query || dbResult.query || 'N/A',
        rows: dbResult.rows || [],
        columns: dbResult.columns || [],
        rowCount: typeof dbResult.row_count === 'number' ? dbResult.row_count : undefined,
        status: 'success',
        message: dbResult.message || `Query executed successfully. ${dbResult.row_count || (dbResult.rows ? dbResult.rows.length : 0)} rows returned.`,
      });
    }

    return prepareResult({
      queryLabel: query || dbResult.query || 'N/A',
      rows: [],
      columns: [],
      rowCount: 0,
      status: 'error',
      error: dbResult.error,
      message: `Query failed: ${dbResult.error}`,
    });
  }

  return dbResult;
}

// Initialize dashboard helper
async function initializeDashboard(message?: string): Promise<any> {
  const welcomeMessage = message || "Welcome to Vdata Analytics";

  if (!isDatabaseConfigured) {
    return {
      status: 'error',
      message: welcomeMessage,
      error: 'Database not connected. Please configure DATABASE_URL environment variable.',
      results: [],
      columns: [],
      truncated: false,
    };
  }

  try {
    // Try to get table count
    const schemaResult = await executeQuery("SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'");

    if (schemaResult.success) {
      return {
        status: 'success',
        message: `${welcomeMessage}. Connected to database with ${schemaResult.rows![0].table_count} tables.`,
        results: [],
        columns: [],
        truncated: false,
      };
    } else {
      return {
        status: 'error',
        message: welcomeMessage,
        error: `Failed to connect to database: ${schemaResult.error}`,
        results: [],
        columns: [],
        truncated: false,
      };
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: welcomeMessage,
      error: `Failed to connect to database: ${error.message}`,
      results: [],
      columns: [],
      truncated: false,
    };
  }
}

// Get schema helper (generic - works for all tables)
async function getSchemaInfo(tableName?: string): Promise<any> {
  if (!isDatabaseConfigured) {
    throw new Error("Database connection not configured. Set DATABASE_URL environment variable.");
  }

  try {
    if (tableName) {
      // Get columns for specific table
      const result = await executeQuery(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, undefined, [tableName]);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schema');
      }

      const rows = result.rows ?? [];
      const rowCount = typeof result.row_count === 'number' ? result.row_count : rows.length;

      return {
        query: `DESCRIBE TABLE ${tableName}`,
        results: rows,
        columns: ['column_name', 'data_type', 'is_nullable', 'column_default'],
        rowCount,
        status: 'success',
        message: `Schema for table '${tableName}': ${rowCount} columns`,
        truncated: false,
      };
    } else {
      // List all tables
      const result = await executeQuery(`
        SELECT
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      if (!result.success) {
        throw new Error(result.error || 'Failed to list tables');
      }

      const rows = result.rows ?? [];
      const rowCount = typeof result.row_count === 'number' ? result.row_count : rows.length;

      return {
        query: 'SHOW TABLES',
        results: rows,
        columns: ['table_name', 'table_type'],
        rowCount,
        status: 'success',
        message: `Found ${rowCount} tables in the database`,
        truncated: false,
      };
    }
  } catch (error: any) {
    return {
      query: tableName ? `DESCRIBE TABLE ${tableName}` : 'SHOW TABLES',
      results: [],
      columns: [],
      rowCount: 0,
      status: 'error',
      error: error.message,
      truncated: false,
    };
  }
}

// Create MCP server instance
function createVdataServer(): Server {
  const server = new Server(
    {
      name: "vdata-analytics",
      version: "1.0.0"
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // Handle list resources
  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => ({
      resources
    })
  );

  // Handle read resource
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      if (request.params.uri !== WIDGET_URI) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: "text/html+skybridge",
            text: WIDGET_HTML,
            _meta: widgetMeta()
          }
        ]
      };
    }
  );

  // Handle list tools
  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({
      tools
    })
  );

  // Handle call tool
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const { name } = request.params;

      try {
        switch (name) {
          // Compatibility alias
          case "show_vdata_app":
          case "initialize_dashboard": {
            const args = initializeDashboardSchema.parse(request.params.arguments ?? {});
            const result = await initializeDashboard(args.message);

            return {
              content: [
                {
                  type: "text",
                  text: result.message
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          case "run_query": {
            const args = runQuerySchema.parse(request.params.arguments ?? {});
            const dbResult = await executeQuery(args.query, args.limit);
            const result = formatDatabaseResult(dbResult, args.query, {
              displayLimit: RAW_DATA_EXPORT_ROW_CAP,
            });

            return {
              content: [
                {
                  type: "text",
                  text: result.message || `Executed query: ${args.query}`
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          case "get_schema": {
            const args = getSchemaSchema.parse(request.params.arguments ?? {});
            const result = await getSchemaInfo(args.tableName);

            return {
              content: [
                {
                  type: "text",
                  text: result.message || "Retrieved schema information"
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          case "get_sample_data": {
            const args = getSampleDataSchema.parse(request.params.arguments ?? {});
            const dbResult = await getSampleData(args.limit);
            const result = formatDatabaseResult(dbResult, `SELECT * FROM digital_insights LIMIT ${args.limit || 10}`);

            return {
              content: [
                {
                  type: "text",
                  text: result.message || "Retrieved sample data"
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          case "get_database_statistics": {
            const dbResult = await getDatabaseStatistics();
            const result = formatDatabaseResult(dbResult, "Database Statistics");

            return {
              content: [
                {
                  type: "text",
                  text: result.message || "Retrieved database statistics"
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          case "get_column_value_counts": {
            const args = getColumnValueCountsSchema.parse(request.params.arguments ?? {});
            const dbResult = await getColumnValueCounts(args.columnName, args.limit);
            const result = formatDatabaseResult(dbResult, `Column distribution for ${args.columnName}`);

            return {
              content: [
                {
                  type: "text",
                  text: result.message || `Retrieved value counts for ${args.columnName}`
                }
              ],
              structuredContent: result,
              _meta: widgetMeta()
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`
            }
          ],
          structuredContent: {
            status: 'error',
            error: error.message,
            results: [],
            columns: [],
            message: `Error: ${error.message}`
          },
          _meta: widgetMeta(),
          isError: true
        };
      }
    }
  );

  return server;
}

// Session management
type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";

// Handle SSE connection (GET /mcp)
async function handleSseRequest(res: ServerResponse) {
  console.log("📡 New SSE connection");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const server = createVdataServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    console.log(`🔌 Session closed: ${sessionId}`);
    sessions.delete(sessionId);
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

// Handle POST messages (POST /mcp/messages?sessionId=xxx)
async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

// Create HTTP server
const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    // Handle CORS preflight
    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        database: isDatabaseConfigured ? "connected" : "not configured"
      }));
      return;
    }

    // Server info
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "Vdata Analytics MCP Server",
        version: "1.0.0",
        status: "running",
        mcp_endpoint: "/mcp",
        database: isDatabaseConfigured ? "connected" : "not configured",
        tools: tools.map(t => ({ name: t.name, title: t.title }))
      }));
      return;
    }

    // SSE endpoint
    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    // POST messages endpoint
    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    // Static asset serving for component files (support GET and HEAD)
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/")) {
      const fileName = url.pathname.replace("/assets/", "");

      // Only allow component.js and component.css
      if (fileName === "component.js" || fileName === "component.css") {
        try {
          const filePath = join(__dirname, "../../web/dist", fileName);
          const fileBuffer = readFileSync(filePath);

          // Set proper MIME type
          const mimeType = fileName.endsWith(".js")
            ? "application/javascript"
            : "text/css";

          const headers: Record<string, string | number> = {
            "Content-Type": mimeType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600", // Cache for 1 hour
            "Content-Length": fileBuffer.length,
          };

          res.writeHead(200, headers);

          if (req.method === "HEAD") {
            res.end();
          } else {
            res.end(fileBuffer);
          }
          return;
        } catch (error) {
          console.error(`Failed to serve ${fileName}:`, error);
          res.writeHead(404).end("Asset not found");
          return;
        }
      } else {
        res.writeHead(403).end("Forbidden");
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  await closePool();
  httpServer.close();
  process.exit(0);
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🚀 Vdata Analytics MCP Server Running   ║
╠════════════════════════════════════════════╣
║  Port:     ${PORT.toString().padEnd(32)} ║
║  SSE:      GET  /mcp${' '.repeat(22)} ║
║  POST:     POST /mcp/messages${' '.repeat(11)} ║
║  Database: ${(isDatabaseConfigured ? 'Connected ✅' : 'Not configured ⚠️').padEnd(32)} ║
║  Tools:    ${tools.length} available${' '.repeat(23)} ║
╚════════════════════════════════════════════╝

Available Tools:
${tools.map(t => `  • ${t.name} - ${t.title}`).join('\n')}
  `);
});
