FROM node:20-alpine
WORKDIR /app
ARG CACHEBUST=20260404
COPY package*.json ./
RUN npm ci

# Build the MCP server TypeScript
COPY tsconfig.server.json ./
COPY src ./src
RUN npm run build:mcp

# Remove devDeps for smaller production image
RUN npm prune --omit=dev

# Copy HTTP server entry point (v2 - hash chaining)
COPY http-server.cjs ./http-server.cjs

ENV AUDIT_DATA_DIR=/app/data
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# Create data directory for persistent waitlist storage
RUN mkdir -p /app/data

CMD ["node", "http-server.cjs"]
