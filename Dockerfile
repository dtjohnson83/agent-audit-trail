FROM node:20-alpine
WORKDIR /app

# Install all deps (including devDeps for TypeScript build)
COPY package*.json ./
RUN npm ci

# Build the MCP server TypeScript
COPY tsconfig.server.json ./
COPY src ./src
RUN npm run build:mcp

# Remove devDeps from production image
RUN npm prune --omit=dev

# Copy server entry point
COPY http-server.js ./http-server.js

ENV AUDIT_DATA_DIR=/app/data
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", "http-server.js"]
