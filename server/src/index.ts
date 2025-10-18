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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port from environment or default to 8000
const PORT = parseInt(process.env.PORT || "8000", 10);

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
      root.innerHTML = '<div style="padding: 20px; font-family: system-ui;"><h1>🎉 Hello from Vdata App!</h1><p>This is a minimal test to verify the MCP server and UI integration works.</p></div>';
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
const WIDGET_URI = "ui://vdata/main.html";
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

// Define resources
const resources: Resource[] = [
  {
    uri: WIDGET_URI,
    name: "Vdata App Widget",
    description: "Vdata App UI component",
    mimeType: "text/html+skybridge",
    _meta: {
      "openai/widgetPrefersBorder": true,
      "openai/widgetDomain": "https://chatgpt.com",
      "openai/widgetCSP": {
        connect_domains: [],
        resource_domains: []
      }
    }
  }
];

// Define tools
const tools: Tool[] = [
  {
    name: "show_vdata_app",
    description: "Display the Vdata App interface with a welcome message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional message to display"
        }
      },
      additionalProperties: false
    },
    title: "Show Vdata App",
    _meta: {
      "openai/outputTemplate": WIDGET_URI,
      "openai/toolInvocation/invoking": "Loading Vdata App...",
      "openai/toolInvocation/invoked": "Vdata App loaded",
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true
    },
    annotations: {
      destructiveHint: false,
      openWorldHint: false,
      readOnlyHint: true
    }
  }
];

// Tool input parser
const toolInputParser = z.object({
  message: z.string().optional()
});

// Create MCP server instance
function createVdataServer(): Server {
  const server = new Server(
    {
      name: "vdata-app",
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
            _meta: {
              "openai/widgetPrefersBorder": true,
              "openai/widgetDomain": "https://chatgpt.com",
              "openai/widgetCSP": {
                connect_domains: [],
                resource_domains: []
              }
            }
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
      if (request.params.name !== "show_vdata_app") {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      const args = toolInputParser.parse(request.params.arguments ?? {});
      const message = args.message || "Welcome to Vdata App!";

      return {
        content: [
          {
            type: "text",
            text: `Displaying Vdata App: ${message}`
          }
        ],
        structuredContent: {
          message: message,
          timestamp: new Date().toISOString(),
          status: "success"
        },
        _meta: {
          "openai/outputTemplate": WIDGET_URI
        }
      };
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
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Server info
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        name: "Vdata App MCP Server",
        version: "1.0.0",
        status: "running",
        mcp_endpoint: "/mcp"
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

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 Vdata App MCP Server Running     ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(32)} ║
║  SSE:  GET  /mcp${' '.repeat(24)} ║
║  POST: POST /mcp/messages${' '.repeat(13)} ║
╚════════════════════════════════════════╝
  `);
});

