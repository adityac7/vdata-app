#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { URL } from "url";
import { Pool, type QueryResult } from "pg";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port and database URL from environment
const PORT = parseInt(process.env.PORT || "8000", 10);
const DATABASE_URL = process.env.DATABASE_URL;

// PostgreSQL connection pool
let pool: Pool | null = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : {
      rejectUnauthorized: false // Required for Render PostgreSQL
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  console.log('✅ PostgreSQL pool initialized');
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
        connect_domains: DATABASE_URL ? [new URL(DATABASE_URL).hostname] : [],
        resource_domains: []
      }
    })
  }
];

// Tool input schemas
const runQuerySchema = z.object({
  query: z.string().describe("SQL SELECT query to execute"),
  limit: z.number().optional().describe("Optional limit for results (default: 100)")
});

const getSchemaSchema = z.object({
  tableName: z.string().optional().describe("Optional table name to get schema for specific table")
});

const executeAnalyticsSchema = z.object({
  question: z.string().describe("Natural language question about the data")
});

// Define tools - following OpenAI Apps SDK pattern
const tools: Tool[] = [
  {
    name: "run_query",
    description: "Execute a SELECT query on the PostgreSQL database and display results in the analytics dashboard",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute"
        },
        limit: {
          type: "number",
          description: "Optional limit for results (default: 100)"
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
    description: "Get database schema information - list all tables or details for a specific table",
    inputSchema: {
      type: "object",
      properties: {
        tableName: {
          type: "string",
          description: "Optional table name to get schema for specific table"
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
    name: "initialize_dashboard",
    description: "Initialize the analytics dashboard and show database status",
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
  }
];

// Database helper functions
async function executeQuery(query: string, limit?: number): Promise<any> {
  if (!pool) {
    throw new Error("Database connection not configured. Set DATABASE_URL environment variable.");
  }

  const startTime = Date.now();

  // Add LIMIT if not present and limit is specified
  let finalQuery = query.trim();
  if (limit && !finalQuery.toLowerCase().includes('limit')) {
    finalQuery += ` LIMIT ${limit}`;
  }

  try {
    const result: QueryResult = await pool.query(finalQuery);
    const executionTime = Date.now() - startTime;

    const columns = result.fields.map(field => field.name);
    const results = result.rows;

    return {
      query: finalQuery,
      results,
      columns,
      rowCount: result.rowCount,
      status: 'success',
      executionTime,
      message: `Query executed successfully. ${result.rowCount} rows returned.`
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    return {
      query: finalQuery,
      results: [],
      columns: [],
      rowCount: 0,
      status: 'error',
      executionTime,
      error: error.message,
      message: `Query failed: ${error.message}`
    };
  }
}

async function getSchema(tableName?: string): Promise<any> {
  if (!pool) {
    throw new Error("Database connection not configured. Set DATABASE_URL environment variable.");
  }

  try {
    if (tableName) {
      // Get columns for specific table
      const result = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      return {
        query: `DESCRIBE TABLE ${tableName}`,
        results: result.rows,
        columns: ['column_name', 'data_type', 'is_nullable', 'column_default'],
        rowCount: result.rowCount,
        status: 'success',
        message: `Schema for table '${tableName}': ${result.rowCount} columns`
      };
    } else {
      // List all tables
      const result = await pool.query(`
        SELECT
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      return {
        query: 'SHOW TABLES',
        results: result.rows,
        columns: ['table_name', 'table_type'],
        rowCount: result.rowCount,
        status: 'success',
        message: `Found ${result.rowCount} tables in the database`
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

async function initializeDashboard(message?: string): Promise<any> {
  const welcomeMessage = message || "Welcome to Vdata Analytics";

  if (!pool) {
    return {
      status: 'error',
      message: welcomeMessage,
      error: 'Database not connected. Please configure DATABASE_URL environment variable.',
      results: [],
      columns: []
    };
  }

  try {
    // Get database status
    const result = await pool.query(`
      SELECT
        COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    return {
      status: 'success',
      message: `${welcomeMessage}. Connected to database with ${result.rows[0].table_count} tables.`,
      results: [],
      columns: []
    };
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
                connect_domains: DATABASE_URL ? [new URL(DATABASE_URL).hostname] : [],
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
          case "run_query": {
            const args = runQuerySchema.parse(request.params.arguments ?? {});
            const result = await executeQuery(args.query, args.limit);

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
            const result = await getSchema(args.tableName);

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

          case "initialize_dashboard": {
            const args = z.object({ message: z.string().optional() }).parse(request.params.arguments ?? {});
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
            columns: []
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
        database: pool ? "connected" : "not configured"
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
        database: pool ? "connected" : "not configured",
        tools: tools.map(t => t.name)
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
  if (pool) {
    await pool.end();
  }
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
║  Database: ${(pool ? 'Connected ✅' : 'Not configured ⚠️').padEnd(32)} ║
╚════════════════════════════════════════════╝
  `);
});
