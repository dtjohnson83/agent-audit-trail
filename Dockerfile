FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist ./dist
COPY .smithery ./dist
ENV AUDIT_DATA_DIR=/app/data
ENV PORT=3000
EXPOSE 3000
CMD ["node", "http-server.js"]
