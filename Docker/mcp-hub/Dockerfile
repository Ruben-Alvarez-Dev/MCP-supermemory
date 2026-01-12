# ============================================================
# MCP-SUPERSERVER - MCP Hub Dockerfile
# ============================================================
# Wanaku-based MCP router with middleware and all MCP servers

FROM node:20-alpine

LABEL maintainer="MCP-SUPERSERVER"
LABEL description="MCP Hub with Wanaku router, middleware, and all MCP servers"

# Build arguments for configuration
ARG NEO4J_URI=bolt://neo4j:7687
ARG OLLAMA_HOST=ollama
ARG OLLAMA_PORT=11434

# Install dependencies
RUN apk add --no-cache \
    curl \
    python3 \
    py3-pip \
    git \
    bash \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Install Python dependencies for MCP servers
RUN pip3 install --no-cache-dir --break-system-packages \
    mcp \
    neo4j \
    python-dotenv || true

# Copy application code
COPY . .

# Create directories
RUN mkdir -p /app/logs /app/config /app/data

# Set environment variables
ENV NODE_ENV=production \
    NEO4J_URI=${NEO4J_URI} \
    OLLAMA_HOST=${OLLAMA_HOST} \
    OLLAMA_PORT=${OLLAMA_PORT} \
    MCP_HUB_PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=60s \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose API port
EXPOSE 3000

# Run as non-root user
RUN addgroup -g 1001 -S mcp && \
    adduser -u 1001 -S mcp -G mcp && \
    chown -R mcp:mcp /app

USER mcp

# Start the MCP Hub
CMD ["node", "src/index.js"]
