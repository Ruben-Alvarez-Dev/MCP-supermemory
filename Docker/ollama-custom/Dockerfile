# ============================================================
# MCP-SUPERSERVER - Ollama Custom Dockerfile
# ============================================================
# Optimized Ollama for local LLM inference with model mesh

FROM ollama/ollama:latest

LABEL maintainer="MCP-SUPERSERVER"
LABEL description="Local LLM inference with model mesh routing"

# Set working directory
WORKDIR /root

# Copy model discovery script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Copy model registry
COPY models.json /models.json

# Create models directory
RUN mkdir -p /root/.ollama/models && \
    chown -R root:root /root/.ollama

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:11434/api/tags || exit 1

# Expose API port
EXPOSE 11434

# Set environment variables
ENV OLLAMA_HOST=0.0.0.0 \
    OLLAMA_PORT=11434 \
    OLLAMA_MODELS=llama3.3,qwq,codellama \
    OLLAMA_ORIGINS=*

# Use custom entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["ollama", "serve"]
