FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.server.json ./
COPY src ./src
RUN npm run build:mcp

COPY http-server.cjs ./http-server.cjs

ENV AUDIT_DATA_DIR=/app/data
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", "http-server.cjs"]
