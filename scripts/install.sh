#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Installation Script
# ============================================================
# This script installs and configures all components

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║     MCP-SUPERSERVER - Installation                  ║"
echo "║     Unified AI Memory and Reasoning Hub              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ============================================================
# FUNCTIONS
# ============================================================

check_requirements() {
    echo -e "${BLUE}📋 Checking requirements...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "   Install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    echo -e "${GREEN}   ✓ Docker${NC}"

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}   ✓ Docker Compose${NC}"

    # Check available memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        TOTAL_MEM=$(sysctl hw.memsize | awk '{print $2/1024/1024/1024}')
    else
        TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    fi

    if (( $(echo "$TOTAL_MEM < 16" | bc -l) )); then
        echo -e "${YELLOW}⚠️  Warning: Less than 16GB RAM available${NC}"
        echo "   16GB+ recommended for optimal performance"
    else
        echo -e "${GREEN}   ✓ RAM: ${TOTAL_MEM}GB${NC}"
    fi

    echo -e "${GREEN}✅ All requirements met${NC}"
}

create_directories() {
    echo -e "${BLUE}📁 Creating directory structure...${NC}"

    mkdir -p data/neo4j/{data,plugins,conf}
    mkdir -p data/ollama/models
    mkdir -p data/obsidian/AI_Logs
    mkdir -p data/obsidian/AI_Memory/{Proyectos,Decisiones,Conocimiento}
    mkdir -p logs
    mkdir -p exports

    echo -e "${GREEN}✅ Directories created${NC}"
}

setup_env() {
    echo -e "${BLUE}📝 Setting up environment configuration...${NC}"

    if [ -f .env ]; then
        echo -e "${YELLOW}⚠️  .env already exists. Skipping creation.${NC}"
        read -p "Do you want to edit .env now? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        fi
    else
        cp .env.example .env
        echo -e "${GREEN}✅ .env created from .env.example${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env and change default passwords!${NC}"
        read -p "Press Enter to edit .env now..."
        ${EDITOR:-nano} .env
    fi
}

build_images() {
    echo -e "${BLUE}🐳 Building Docker images...${NC}"
    docker-compose build
    echo -e "${GREEN}✅ Images built${NC}"
}

start_services() {
    echo -e "${BLUE}🚀 Starting services...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Services started${NC}"
}

wait_for_neo4j() {
    echo -e "${BLUE}⏳ Waiting for Neo4j to be ready...${NC}"

    # Get password from .env
    if [ -f .env ]; then
        source .env
    fi
    NEO4J_PASSWORD=${NEO4J_PASSWORD:-change_me_in_production}

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if docker-compose exec -T neo4j cypher-shell -u neo4j -p "$NEO4J_PASSWORD" "RETURN 1" &> /dev/null; then
            echo -e "${GREEN}✅ Neo4j is ready${NC}"
            return 0
        fi
        echo -n "."
        sleep 5
        ((attempt++))
    done

    echo -e "${RED}❌ Neo4j failed to start${NC}"
    return 1
}

pull_ollama_models() {
    echo -e "${BLUE}📦 Pulling Ollama models...${NC}"

    # Get models from .env
    if [ -f .env ]; then
        source .env
    fi
    OLLAMA_MODELS=${OLLAMA_MODELS:-llama3.3,qwq,codellama}

    for model in ${OLLAMA_MODELS//,/ }; do
        echo -n "   Pulling $model..."
        if docker-compose exec -T ollama ollama pull "$model" &> /dev/null; then
            echo -e " ${GREEN}✓${NC}"
        else
            echo -e " ${YELLOW}✗ (failed)${NC}"
        fi
    done

    echo -e "${GREEN}✅ Models pulled${NC}"
}

create_initial_backup() {
    echo -e "${BLUE}💾 Creating initial backup...${NC}"
    if [ -f scripts/backup/create-backup.sh ]; then
        bash scripts/backup/create-backup.sh
    else
        echo -e "${YELLOW}⚠️  Backup script not found yet${NC}"
    fi
}

print_success() {
    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║              Installation Complete!                  ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "🎯 Next steps:"
    echo ""
    echo "   1. Edit .env if you haven't already"
    echo "   2. Configure your CLIs to connect to the MCP Hub:"
    echo "      - MCP Hub URL: http://localhost:3000"
    echo "   3. Review documentation:"
    echo "      - docs/INSTALLATION.md"
    echo "      - docs/CONFIGURATION.md"
    echo ""
    echo "📊 Service URLs:"
    echo ""
    echo "   - MCP Hub API:     http://localhost:3000"
    echo "   - Neo4j Browser:   http://localhost:7474"
    echo "   - Ollama API:      http://localhost:11434"
    echo "   - Prometheus:      http://localhost:9090"
    echo ""
    echo "🔧 Useful commands:"
    echo ""
    echo "   make status    - Check service status"
    echo "   make logs      - View logs"
    echo "   make backup    - Create backup"
    echo "   make stop      - Stop all services"
    echo ""
}

# ============================================================
# MAIN INSTALLATION
# ============================================================

main() {
    check_requirements
    create_directories
    setup_env
    build_images
    start_services
    wait_for_neo4j
    pull_ollama_models
    create_initial_backup
    print_success
}

# Run main function
main
