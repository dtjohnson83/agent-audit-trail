/**
 * Agent Audit Trail - HTTP Server for Railway/Railway-compatible deployment
 * Uses MCP SDK StreamableHTTPServerTransport for Smithery HTTP endpoint
 */
const http = require("http");

async function start() {
  // Dynamic import for ESM modules (CJS file)
  const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js");
  const { createSandboxServer } = await import("./dist/index.js");

  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.HOST || "0.0.0.0";

  const server = createSandboxServer();
  const transport = new StreamableHTTPServerTransport({
    host: HOST,
    corsAllowedHeaders: "*",
    maxRequestSize: 10 * 1024 * 1024,
  });

  transport.onclose = () => {
    console.error("MCP client disconnected");
  };

  await server.connect(transport);

  const httpServer = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    transport.handleRequest(req, res, null);
  });

  httpServer.listen(PORT, HOST, () => {
    console.error(`Agent Audit Trail MCP server running on HTTP port ${PORT}`);
  });

  process.on("SIGTERM", () => {
    console.error("SIGTERM received, shutting down...");
    httpServer.close();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
