/**
 * Agent Audit Trail - HTTP Server for Railway/Railway-compatible deployment
 * Uses MCP SDK StreamableHTTPServerTransport for Smithery HTTP endpoint
 */
import { createServer } from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js";
import { createSandboxServer } from "./dist/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const server = createSandboxServer();
  const transport = new StreamableHTTPServerTransport({
    port: PORT,
    host: HOST,
    // Enable CORS for Smithery cross-origin requests
    corsAllowedHeaders: "*",
    // Max request size 10MB
    maxRequestSize: 10 * 1024 * 1024,
  });

  transport.onclose = () => {
    console.error("MCP client disconnected");
  };

  await server.connect(transport);

  const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Handle MCP requests via the transport
    transport.handleRequest(req, res, null);
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`Agent Audit Trail MCP server running on HTTP port ${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.error("SIGTERM received, shutting down...");
    httpServer.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
