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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port and database URL from environment
const PORT = parseInt(process.env.PORT || "8000", 10);
const DATABASE_URL = process.env.DATABASE_URL;

// Check if database is configured
const isDatabaseConfigured = !!DATABASE_URL;

if (isDatabaseConfigured) {
  console.log('✅ DATABASE_URL configured');
} else {
  console.warn('⚠️  DATABASE_URL not set - database tools will not work');
}

// Load the built React component
let COMPONENT_JS = "";
let COMPONENT_CSS = "";

try {
  COMPONENT_JS = readFileSync(join(__dirname, "../../web/dist/component.js"), "utf8");
  console.log("✅ Loaded component.js");
} catch (error) {
  console.warn("⚠️  Component JS not found, using placeholder");
  COMPONENT_JS = `
    console.log("Vdata App loaded!");
    const root = document.getElementById("vdata-root");
    if (root) {
      root.innerHTML = '<div style="padding: 20px; font-family: system-ui;"><h1>🎉 Vdata Analytics</h1><p>UI component not built. Run: cd web && npm run build</p></div>';
    }
  `;
}

try {
  COMPONENT_CSS = readFileSync(join(__dirname, "../../web/dist/component.css"), "utf8");
  console.log("✅ Loaded component.css");
} catch (error) {
  console.warn("⚠️  Component CSS not found, using placeholder");
  COMPONENT_CSS = `
    body { margin: 0; padding: 0; }
    #vdata-root { font-family: system-ui, -apple-system, sans-serif; }
  `;
}

// Widget configuration
const WIDGET_URI = "ui://vdata/analytics-dashboard.html";
const WIDGET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${COMPONENT_CSS}</style>
</head>
<body>
  <div id="vdata-root"></div>
  <script type="module">${COMPONENT_JS}</script>
</body>
</html>
`.trim();

// Helper function to create widget metadata
function widgetMeta(additionalMeta: Record<string, any> = {}) {
  return {
    "openai/outputTemplate": WIDGET_URI,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
    "openai/widgetPrefersBorder": true,
    "openai/widgetDomain": "https://chatgpt.com",
    ...additionalMeta,
  };
}

// Define resources
const resources: Resource[] = [
  {
    uri: WIDGET_URI,
    name: "Vdata Analytics Dashboard",
    description: "Interactive analytics dashboard for PostgreSQL data",
    mimeType: "text/html+skybridge",
    _meta: widgetMeta({
      "openai/widgetCSP": {
        // connect_domains requires full URLs, not just hostnames
        connect_domains: DATABASE_URL ? [`https://${new URL(DATABASE_URL).hostname}`] : [],
        resource_domains: []
      }
    })
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
    description: "Execute a SELECT query on the PostgreSQL database (digital_insights table) and display results in the analytics dashboard. Automatically adds LIMIT if not specified.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute"
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
    description: "Get database schema information. If tableName is provided, returns column details for that table. Otherwise, lists all tables in the database.",
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
    description: "Get a sample of rows from the digital_insights table to preview the data structure and content",
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
    description: "Get statistics about the digital_insights table including total row count and platform distribution (type, count, avg duration, percentage)",
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
    description: "Get value distribution for a specific column in the digital_insights table. Shows count and percentage for each unique value.",
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
function formatDatabaseResult(dbResult: any, query?: string): any {
  if (typeof dbResult === 'string') {
    // Parse JSON string response from database.ts functions
    try {
      const parsed = JSON.parse(dbResult);

      // Convert to dashboard format
      return {
        query: query || parsed.query || 'N/A',
        results: parsed.data || parsed.rows || parsed.columns || parsed.platforms || parsed.distribution || [],
        columns: parsed.columns || (parsed.data && parsed.data.length > 0 ? Object.keys(parsed.data[0]) : []),
        rowCount: parsed.row_count || parsed.sample_size || parsed.unique_values || (parsed.data ? parsed.data.length : 0),
        status: 'success',
        message: parsed.message || `Query completed successfully`,
      };
    } catch (e) {
      // If it starts with "Error:", treat as error
      if (dbResult.startsWith('Error:')) {
        return {
          query: query || 'N/A',
          results: [],
          columns: [],
          rowCount: 0,
          status: 'error',
          error: dbResult.replace('Error: ', ''),
          message: dbResult
        };
      }
      // Otherwise return as message
      return {
        query: query || 'N/A',
        results: [],
        columns: [],
        rowCount: 0,
        status: 'success',
        message: dbResult
      };
    }
  }

  // Already in correct format from executeQuery
  if (dbResult.success !== undefined) {
    return {
      query: query || dbResult.query || 'N/A',
      results: dbResult.rows || [],
      columns: dbResult.columns || [],
      rowCount: dbResult.row_count || 0,
      status: dbResult.success ? 'success' : 'error',
      error: dbResult.error,
      message: dbResult.success
        ? `Query executed successfully. ${dbResult.row_count || 0} rows returned.`
        : `Query failed: ${dbResult.error}`
    };
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
      columns: []
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
        columns: []
      };
    } else {
      return {
        status: 'error',
        message: welcomeMessage,
        error: `Failed to connect to database: ${schemaResult.error}`,
        results: [],
        columns: []
      };
    }
  } catch (error: any) {
    return {
      status: 'error',
      message: welcomeMessage,
      error: `Failed to connect to database: ${error.message}`,
      results: [],
      columns: []
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
      `, undefined);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch schema');
      }

      return {
        query: `DESCRIBE TABLE ${tableName}`,
        results: result.rows,
        columns: ['column_name', 'data_type', 'is_nullable', 'column_default'],
        rowCount: result.row_count,
        status: 'success',
        message: `Schema for table '${tableName}': ${result.row_count} columns`
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

      return {
        query: 'SHOW TABLES',
        results: result.rows,
        columns: ['table_name', 'table_type'],
        rowCount: result.row_count,
        status: 'success',
        message: `Found ${result.row_count} tables in the database`
      };
    }
  } catch (error: any) {
    return {
      query: tableName ? `DESCRIBE TABLE ${tableName}` : 'SHOW TABLES',
      results: [],
      columns: [],
      rowCount: 0,
      status: 'error',
      error: error.message
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
            _meta: widgetMeta({
              "openai/widgetCSP": {
                // connect_domains requires full URLs, not just hostnames
                connect_domains: DATABASE_URL ? [`https://${new URL(DATABASE_URL).hostname}`] : [],
                resource_domains: []
              }
            })
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
            const result = formatDatabaseResult(dbResult, args.query);

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
