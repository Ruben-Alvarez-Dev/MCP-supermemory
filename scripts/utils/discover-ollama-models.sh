#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Ollama Model Discovery Script
# ============================================================
# Automatically discovers available Ollama models

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Discovering Ollama Models...${NC}"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Ollama is not running${NC}"
    echo "Start Ollama with: make start"
    exit 1
fi

# Get list of models
MODELS=$(curl -s http://localhost:11434/api/tags | jq -r '.models[].name')

if [ -z "$MODELS" ]; then
    echo -e "${YELLOW}⚠️  No models found${NC}"
    echo "Pull models with: ollama pull <model_name>"
    exit 0
fi

echo -e "${GREEN}Available models:${NC}"
echo "$MODELS" | while read -r model; do
    echo "  • $model"
done

# Update config with discovered models
CONFIG_FILE="config/mcp-hub.json"
TEMP_FILE=$(mktemp)

if [ -f "$CONFIG_FILE" ]; then
    echo ""
    echo -e "${BLUE}Updating $CONFIG_FILE...${NC}"

    # Convert models to JSON array
    MODELS_ARRAY=$(echo "$MODELS" | jq -R -s -c 'split("\n") | map(select(length > 0))')

    # Update the config (preserving other settings)
    if command -v jq &> /dev/null; then
        jq --argjson models "$MODELS_ARRAY" \
            '.backends.ollama.discovery.available_models = $models |
             .backends.ollama.discovery.last_discovered = (now | todate)' \
            "$CONFIG_FILE" > "$TEMP_FILE"
        mv "$TEMP_FILE" "$CONFIG_FILE"
        echo -e "${GREEN}✅ Configuration updated${NC}"
    else
        echo -e "${YELLOW}⚠️  jq not found, skipping config update${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ Discovery complete${NC}"
echo "Total models: $(echo "$MODELS" | wc -l | tr -d ' ')"
