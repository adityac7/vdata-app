#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get port from environment or default to 8000
const PORT = parseInt(process.env.PORT || "8000", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Create MCP server
const server = new McpServer({
  name: "vdata-app",
  version: "1.0.0"
});

// Load the built React component
let COMPONENT_JS = "";
let COMPONENT_CSS = "";

try {
  // In production, these will be in the web/dist folder
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

// Register the UI resource
server.registerResource(
  "vdata-widget",
  "ui://vdata/main.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://vdata/main.html",
        mimeType: "text/html+skybridge",
        text: `
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
        `.trim(),
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
  })
);

// Register a simple test tool
server.registerTool(
  "show_vdata_app",
  {
    title: "Show Vdata App",
    description: "Display the Vdata App interface with a welcome message",
    _meta: {
      "openai/outputTemplate": "ui://vdata/main.html",
      "openai/toolInvocation/invoking": "Loading Vdata App...",
      "openai/toolInvocation/invoked": "Vdata App loaded"
    },
    inputSchema: {
      message: z.string().optional().describe("Optional message to display")
    }
  },
  async (args) => {
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
      }
    };
  }
);

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Vdata App MCP Server",
    version: "1.0.0",
    status: "running",
    mcp_endpoint: "/mcp"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// MCP endpoint using SSE transport
app.get("/mcp", async (req, res) => {
  console.log("📡 New MCP connection via SSE");
  
  const transport = new SSEServerTransport("/mcp", res);
  await server.connect(transport);
  
  // Keep connection alive
  req.on("close", () => {
    console.log("🔌 MCP connection closed");
  });
});

app.post("/mcp", async (req, res) => {
  console.log("📨 MCP POST request");
  
  const transport = new SSEServerTransport("/mcp", res);
  await server.connect(transport);
  
  // Handle the request
  await transport.handlePostMessage(req.body, res);
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🚀 Vdata App MCP Server Running     ║
╠════════════════════════════════════════╣
║  Host: ${HOST.padEnd(30)} ║
║  Port: ${PORT.toString().padEnd(30)} ║
║  MCP:  http://localhost:${PORT}/mcp${' '.repeat(9)}║
╚════════════════════════════════════════╝
  `);
});

