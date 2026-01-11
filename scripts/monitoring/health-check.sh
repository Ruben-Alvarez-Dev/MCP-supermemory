#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Health Check Script
# ============================================================
# Checks health status of all services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏥 MCP-SUPERSERVER - Health Check${NC}"
echo "======================================"
echo ""

# Service configuration
SERVICES=("neo4j:7687" "ollama:11434" "mcp-hub:3000" "monitoring:9090")
ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"

    echo -n "Checking $name... "

    if docker ps | grep -q "mcp-$name"; then
        # Check if port is responding
        if nc -z localhost "$port" 2>/dev/null; then
            echo -e "${GREEN}✓ HEALTHY${NC}"

            # Get additional info
            case "$name" in
                neo4j)
                    if docker exec mcp-neo4j cypher-shell -u neo4j -p "change_me_in_production" "RETURN 1" &>/dev/null; then
                        echo "  → Bolt protocol responding"
                    else
                        echo -e "  ${YELLOW}⚠ Bolt not responding${NC}"
                        ALL_HEALTHY=false
                    fi
                    ;;
                ollama)
                    MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | jq -r '.models[].name' 2>/dev/null | wc -l)
                    echo "  → $MODELS models available"
                    ;;
                mcp-hub)
                    STATUS=$(curl -s http://localhost:3000/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")
                    echo "  → Status: $STATUS"
                    ;;
                monitoring)
                    echo "  → Prometheus metrics available"
                    ;;
            esac
        else
            echo -e "${YELLOW}⚠ RUNNING but port $port not responding${NC}"
            ALL_HEALTHY=false
        fi
    else
        echo -e "${RED}✗ NOT RUNNING${NC}"
        ALL_HEALTHY=false
    fi
done

echo ""
echo "======================================"

if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✅ All services healthy${NC}"
    exit 0
else
    echo -e "${RED}❌ Some services unhealthy${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  make logs      - View service logs"
    echo "  make restart   - Restart all services"
    echo "  docker ps -a   - Check all containers"
    exit 1
fi
