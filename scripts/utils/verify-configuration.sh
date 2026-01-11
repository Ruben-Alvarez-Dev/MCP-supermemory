#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Configuration Verification Script
# ============================================================
# Verifies that all configuration is correct

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 MCP-SUPERSERVER - Configuration Verification${NC}"
echo "===================================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to check file
check_file() {
    local file=$1
    local description=$2
    local required=${3:-true}

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description: $file"
        return 0
    else
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗${NC} $description: $file (MISSING)"
            ((ERRORS++))
            return 1
        else
            echo -e "${YELLOW}⚠${NC} $description: $file (optional, not found)"
            ((WARNINGS++))
            return 1
        fi
    fi
}

# Function to check directory
check_dir() {
    local dir=$1
    local description=$2

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description: $dir"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} $description: $dir (will be created on install)"
        ((WARNINGS++))
        return 1
    fi
}

# Function to check env var
check_env() {
    local var=$1
    local file=${2:-.env}

    if grep -q "^${var}=" "$file" 2>/dev/null; then
        local value=$(grep "^${var}=" "$file" | cut -d'=' -f2)
        if [[ "$value" == *"change_me"* ]]; then
            echo -e "${YELLOW}⚠${NC} $var: Set to default value (should be changed)"
            ((WARNINGS++))
        else
            echo -e "${GREEN}✓${NC} $var: Configured"
        fi
    else
        echo -e "${YELLOW}⚠${NC} $var: Not set"
        ((WARNINGS++))
    fi
}

# Check required files
echo -e "${BLUE}Required Files:${NC}"
check_file "docker-compose.yml" "Docker Compose configuration"
check_file "Makefile" "Makefile commands"
check_file ".env" "Environment variables"
check_file ".env.example" "Environment template"
check_file "Docker/mcp-hub/Dockerfile" "MCP Hub Dockerfile"
check_file "Docker/neo4j-custom/Dockerfile" "Neo4j Dockerfile"
check_file "Docker/ollama-custom/Dockerfile" "Ollama Dockerfile"
echo ""

# Check configuration files
echo -e "${BLUE}Configuration Files:${NC}"
check_file "config/mcp-hub.json" "MCP Hub configuration" false
check_file "config/protocol-omega.md" "Protocol Omega" false
echo ""

# Check scripts
echo -e "${BLUE}Scripts:${NC}"
check_file "scripts/install.sh" "Installation script"
check_file "scripts/backup/create-backup.sh" "Backup creation"
check_file "scripts/backup/restore.sh" "Backup restoration"
check_file "scripts/monitoring/health-check.sh" "Health check"
echo ""

# Check data directories
echo -e "${BLUE}Data Directories:${NC}"
check_dir "data/neo4j" "Neo4j data"
check_dir "data/ollama" "Ollama models"
check_dir "data/obsidian" "Obsidian vault"
check_dir "logs" "Log files"
check_dir "exports" "Backup exports"
echo ""

# Check environment variables
echo -e "${BLUE}Environment Variables (.env):${NC}"
if [ -f .env ]; then
    check_env "NEO4J_PASSWORD"
    check_env "OLLAMA_MODELS"
    check_env "BACKUP_RETENTION_DAYS"
    check_env "LOG_RETENTION_DAYS"
else
    echo -e "${RED}✗${NC} .env file not found (copy from .env.example)"
    ((ERRORS++))
fi
echo ""

# Summary
echo "===================================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration OK with $WARNINGS warning(s)${NC}"
    exit 0
else
    echo -e "${RED}❌ Configuration failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Fix errors and run again, or run: make install"
    exit 1
fi
