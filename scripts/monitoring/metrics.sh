#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Metrics Display
# ============================================================
# Shows current metrics from all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 MCP-SUPERSERVER - Metrics${NC}"
echo "================================"
echo ""

# Docker container metrics
echo -e "${BLUE}🐳 Docker Containers:${NC}"
docker ps --filter "name=mcp-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Resource usage
echo -e "${BLUE}💻 Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" mcp-* 2>/dev/null || echo "  No containers running"
echo ""

# Neo4j metrics
if docker ps | grep -q mcp-neo4j; then
    echo -e "${BLUE}📈 Neo4j Metrics:${NC}"
    NODE_COUNT=$(docker exec mcp-neo4j cypher-shell -u neo4j -p "change_me_in_production" "MATCH (n) RETURN count(n) as count" 2>/dev/null | grep -E '^[0-9]+$' || echo "N/A")
    REL_COUNT=$(docker exec mcp-neo4j cypher-shell -u neo4j -p "change_me_in_production" "MATCH ()-[r]->() RETURN count(r) as count" 2>/dev/null | grep -E '^[0-9]+$' || echo "N/A")
    echo "  Nodes: $NODE_COUNT"
    echo "  Relationships: $REL_COUNT"
    echo ""
fi

# Ollama metrics
if docker ps | grep -q mcp-ollama; then
    echo -e "${BLUE}🦙 Ollama Metrics:${NC}"
    MODEL_COUNT=$(curl -s http://localhost:11434/api/tags 2>/dev/null | jq '.models | length' 2>/dev/null || echo "N/A")
    echo "  Models loaded: $MODEL_COUNT"
    echo "  Available models:"
    curl -s http://localhost:11434/api/tags 2>/dev/null | jq -r '.models[].name' 2>/dev/null | sed 's/^/    • /' || echo "    Unable to fetch"
    echo ""
fi

# Data volume metrics
echo -e "${BLUE}💾 Data Volumes:${NC}"
du -sh data/* 2>/dev/null | sed 's/^/  /' || echo "  No data yet"
echo ""

# Backup metrics
echo -e "${BLUE}🗄️  Backup Metrics:${NC}"
BACKUP_COUNT=$(ls -1 exports/*.tar.gz 2>/dev/null | wc -l | tr -d ' ')
LATEST_BACKUP=$(readlink exports/LATEST_BACKUP 2>/dev/null || echo "N/A")
LATEST_SIZE=$(du -h "$LATEST_BACKUP" 2>/dev/null | cut -f1 || echo "N/A")
echo "  Total backups: $BACKUP_COUNT"
echo "  Latest backup: $(basename "$LATEST_BACKUP" 2>/dev/null || echo "N/A")"
echo "  Latest size: $LATEST_SIZE"
echo ""

echo "================================"
echo -e "${BLUE}📈 Prometheus Metrics:${NC} http://localhost:9090"
