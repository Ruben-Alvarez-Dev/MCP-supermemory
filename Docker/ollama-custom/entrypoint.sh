#!/bin/bash
# ============================================================
# Ollama Custom Entrypoint
# ============================================================
# Handles model discovery and initialization

set -e

echo "🦙 Ollama MCP-SUPERSERVER Initialization"
echo "========================================"

# Get models from environment or file
OLLAMA_MODELS=${OLLAMA_MODELS:-""}

# Try to read from models.json if exists
if [ -f /models.json ] && [ -z "$OLLAMA_MODELS" ]; then
    OLLAMA_MODELS=$(cat /models.json | jq -r '.models[]' | tr '\n' ',')
fi

# Remove trailing comma
OLLAMA_MODELS=${OLLAMA_MODELS%,}

echo "Model registry configured: ${OLLAMA_MODELS:-none}"

# Start Ollama in background
echo "Starting Ollama server..."
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    echo "  Waiting..."
    sleep 2
done

echo "✅ Ollama is ready"

# Pull models if specified and not already present
if [ -n "$OLLAMA_MODELS" ]; then
    echo ""
    echo "Checking models..."

    for model in ${OLLAMA_MODELS//,/ }; do
        echo -n "  Checking $model... "

        # Check if model exists
        if curl -s http://localhost:11434/api/tags | grep -q "\"name\": \"$model"\""; then
            echo "✓ (exists)"
        else
            echo "→ pulling..."
            ollama pull "$model" > /dev/null 2>&1 && echo "✓ (pulled)" || echo "✗ (failed)"
        fi
    done

    echo ""
    echo "Available models:"
    curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | sed 's/^/  • /'
fi

echo ""
echo "🚀 Ollama ready for model mesh operations"
echo "========================================"

# Keep container running
wait
