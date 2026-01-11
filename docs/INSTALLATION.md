# Installation Guide

## Prerequisites

Before installing MCP-SUPERSERVER, ensure you have:

- **Docker** 20.10 or higher
- **Docker Compose** 2.0 or higher
- **16GB+ RAM** (8GB minimum, 16GB+ recommended)
- **50GB+ disk space**
- **Git** (for cloning the repository)

### Verify Prerequisites

```bash
docker --version
docker-compose --version
git --version
```

## Quick Install

### 1. Clone the Repository

```bash
git clone https://github.com/Ruben-Alvarez-Dev/MCP-superserver.git
cd MCP-superserver
```

### 2. Run the Installation Script

```bash
make install
```

This will:
- Check prerequisites
- Create directory structure
- Set up environment configuration
- Build Docker images
- Start all services
- Wait for Neo4j to be ready
- Pull Ollama models
- Create initial backup

### 3. Verify Installation

```bash
make status
```

All services should show as "healthy".

## Manual Installation

If you prefer manual installation:

### Step 1: Environment Configuration

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

**Important:** Change default passwords!

### Step 2: Create Directories

```bash
mkdir -p data/neo4j/{data,plugins,conf}
mkdir -p data/ollama/models
mkdir -p data/obsidian/AI_Logs
mkdir -p data/obsidian/AI_Memory/{Proyectos,Decisiones,Conocimiento}
mkdir -p logs exports
```

### Step 3: Build Images

```bash
docker-compose build
```

### Step 4: Start Services

```bash
docker-compose up -d
```

### Step 5: Verify Services

```bash
# Check Neo4j
docker exec mcp-neo4j cypher-shell -u neo4j -p "YOUR_PASSWORD" "RETURN 1"

# Check Ollama
curl http://localhost:11434/api/tags

# Check MCP Hub
curl http://localhost:3000/health
```

## Service URLs

After installation:

| Service | URL | Purpose |
|---------|-----|---------|
| MCP Hub API | http://localhost:3000 | Main MCP router |
| Neo4j Browser | http://localhost:7474 | Graph database UI |
| Ollama API | http://localhost:11434 | Model inference |
| Prometheus | http://localhost:9090 | Metrics dashboard |

## Initial Configuration

### Connect Your CLIs

Each CLI needs to connect to the MCP Hub:

**Claude Code** (`~/.claude/config.json`):
```json
{
  "mcpServers": {
    "mcp-hub": {
      "command": "node",
      "args": ["-e", "require('http').createServer((req, res) => { /* proxy to localhost:3000 */ }).listen(3000)"]
    }
  }
}
```

**Gemini CLI** (`~/.gemini/extensions/mcp-hub/`):
See `config/cli-rules/gemini-system-prompt.md`

**Cline** (VSCode):
Copy `config/cli-rules/.clinerules` to your project root

### Test Connection

```bash
# From any CLI, ask:
"Check MCP connection status"
```

## Troubleshooting

### Installation Fails

**Problem:** `docker-compose build` fails

**Solution:**
```bash
# Check Docker is running
docker ps

# Check disk space
df -h

# Try with no cache
docker-compose build --no-cache
```

### Services Won't Start

**Problem:** Services show as "unhealthy"

**Solution:**
```bash
# Check logs
make logs

# Restart services
make restart

# Verify ports are available
netstat -an | grep LISTEN
```

### Neo4j Won't Connect

**Problem:** Can't connect to Neo4j

**Solution:**
```bash
# Check Neo4j logs
make logs-neo4j

# Verify password
docker exec mcp-neo4j cat /var/lib/neo4j/conf/neo4j.conf | grep auth

# Reset password if needed
docker exec -it mcp-neo4j neo4j-admin set-initial-password YOUR_PASSWORD
```

### Ollama Models Not Downloading

**Problem:** Models fail to pull

**Solution:**
```bash
# Check Ollama logs
make logs-ollama

# Manual pull
docker exec -it mcp-ollama ollama pull llama3.3

# Check available space
docker exec mcp-ollama df -h
```

## Next Steps

After successful installation:

1. **Review Configuration**: Edit `.env` for your environment
2. **Connect CLIs**: Configure your AI tools to use MCP Hub
3. **Create First Backup**: `make backup`
4. **Read Documentation**: Check `docs/` for detailed guides

## Uninstallation

To completely remove MCP-SUPERSERVER:

```bash
# Stop and remove volumes (DELETES ALL DATA)
make deep-clean

# Or preserve data:
make stop
# Then manually remove the directory
```

## Getting Help

- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/Ruben-Alvarez-Dev/MCP-superserver/issues
- **Health Check**: `make status`
- **Logs**: `make logs`
