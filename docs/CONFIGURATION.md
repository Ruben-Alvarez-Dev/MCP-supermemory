# Configuration Guide

## Overview

All configuration in MCP-SUPERSERVER is centralized and managed through environment variables and configuration files.

## File Structure

```
config/
├── mcp-hub.json              # MCP Hub main configuration
├── protocol-omega.md         # AI governance protocol
├── prometheus.yml            # Monitoring configuration
├── cli-rules/                # CLI-specific rules
│   ├── .clinerules
│   ├── .cursorrules
│   ├── PROMPT.md
│   └── gemini-system-prompt.md
└── schemas/                  # JSON validation schemas
    ├── log-entry.schema.json
    └── neo4j-entity.schema.json
```

## Environment Variables (.env)

### Neo4j Configuration

```bash
# Connection
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_secure_password

# Memory Settings
NEO4J_dbms_memory_heap_initial__size=512m
NEO4J_dbms_memory_heap_max__size=2G
```

### Ollama Configuration

```bash
# Connection
OLLAMA_HOST=localhost
OLLAMA_PORT=11434

# Models (comma-separated)
OLLAMA_MODELS=llama3.3,qwq,codellama,deepseek-coder,llava,nomic-embed-text

# GPU Support
OLLAMA_GPU_ENABLED=false
OLLAMA_GPU_DRIVER=nvidia
```

### MCP Hub Configuration

```bash
# Server
MCP_HUB_PORT=3000
MCP_HUB_HOST=0.0.0.0

# Logging
LOG_LEVEL=info          # debug, info, warn, error
LOG_FORMAT=json         # json, text
LOG_RETENTION_DAYS=30
```

### Backup Configuration

```bash
# Schedule (cron format)
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Retention
BACKUP_RETENTION_DAYS=7
BACKUP_COMPRESSION=true
```

### Protocol Omega

```bash
PROTOCOL_OMEGA_ENABLED=true
PROTOCOL_OMEGA_ENFORCE=true
PROTOCOL_OMEGA_STRICT_MODE=true
```

## MCP Hub Configuration (mcp-hub.json)

### Router Settings

```json
{
  "router": {
    "port": 3000,
    "host": "0.0.0.0",
    "debug": false
  }
}
```

### Middleware Configuration

```json
{
  "middleware": {
    "logging": {
      "enabled": true,
      "level": "info",
      "format": "structured",
      "destinations": [
        {
          "type": "obsidian",
          "path": "/vault/AI_Logs"
        },
        {
          "type": "neo4j",
          "collection": "activity_logs"
        }
      ]
    }
  }
}
```

### Backend Configuration

#### Neo4j Backend

```json
{
  "neo4j": {
    "enabled": true,
    "uri": "bolt://neo4j:7687",
    "collections": {
      "entities": ["projects", "files", "classes", "bugs"],
      "relationships": ["CONTAINS", "DEFINES", "FIXED_IN", "DEPENDS_ON"]
    }
  }
}
```

#### Ollama Backend

```json
{
  "ollama": {
    "enabled": true,
    "model_registry": {
      "reasoning": {
        "models": ["qwq", "deepseek-r1", "llama3.3"],
        "fallback": "llama3.3"
      },
      "coding": {
        "models": ["codellama", "deepseek-coder"],
        "fallback": "codellama"
      }
    }
  }
}
```

## CLI Configuration

### Claude Code

Edit `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "mcp-superserver": {
      "command": "curl",
      "args": ["http://localhost:3000/tools"],
      "env": {
        "MCP_HUB_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Gemini CLI

Create `~/.gemini/extensions/mcp-superserver/gemini-extension.json`:

```json
{
  "name": "mcp-superserver",
  "mcpServers": {
    "hub": {
      "command": "node",
      "args": ["-e", "require('http').createServer().listen(3000)"]
    }
  }
}
```

### Cline (VSCode)

Copy `.clinerules` to project root:

```bash
cp config/cli-rules/.clinerules /path/to/project/
```

### Cursor

Copy `.cursorrules` to project root:

```bash
cp config/cli-rules/.cursorrules /path/to/project/
```

## Advanced Configuration

### Custom Model Routing

Edit `config/mcp-hub.json`:

```json
{
  "backends": {
    "ollama": {
      "routing": {
        "mode": "manual",
        "rules": [
          {
            "pattern": ".*math.*",
            "models": ["qwq", "deepseek-r1"]
          },
          {
            "pattern": ".*code.*",
            "models": ["codellama", "deepseek-coder"]
          }
        ]
      }
    }
  }
}
```

### Custom Log Format

Edit `config/protocol-omega.md` to add custom log fields:

```markdown
**CustomField:** {value}
```

### Neo4j Custom Queries

Add to `config/mcp-hub.json`:

```json
{
  "neo4j": {
    "queries": {
      "project_context": "MATCH (p:Project {name: $name}) OPTIONAL MATCH (p)-[:CONTAINS]->(f:File) RETURN p, collect(f) as files"
    }
  }
}
```

## Validation

### Validate Configuration

```bash
./scripts/utils/verify-configuration.sh
```

### Test MCP Hub Connection

```bash
curl http://localhost:3000/health
```

### Test Neo4j Connection

```bash
docker exec mcp-neo4j cypher-shell -u neo4j -p "YOUR_PASSWORD" "RETURN 1"
```

## Configuration Templates

### Development Environment

```bash
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=debug
```

### Production Environment

```bash
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=info
NEO4J_PASSWORD=your_secure_random_password
```

## Environment-Specific Overrides

Create `docker-compose.dev.yml` for development:

```yaml
services:
  mcp-hub:
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
    volumes:
      - ./Docker/mcp-hub/src:/app/src:ro  # Hot reload
```

Use with:
```bash
make dev
```

## Troubleshooting Configuration

### Invalid Configuration

**Problem:** Service fails to start

**Solution:**
```bash
# Validate JSON
cat config/mcp-hub.json | jq .

# Check syntax
bash -n .env

# Verify file exists
ls -la config/
```

### Port Conflicts

**Problem:** Ports already in use

**Solution:** Edit `.env`:
```bash
MCP_HUB_PORT=3001
NEO4J_PORT_BOLT=7688
```

### Missing Environment Variables

**Problem**: Service complains about missing vars

**Solution:**
```bash
# Compare with example
diff .env .env.example

# Add missing variables
grep -v '^#' .env.example | grep '=' | while read line; do
    key=$(echo $line | cut -d= -f1)
    if ! grep -q "^$key=" .env; then
        echo "$line" >> .env
    fi
done
```

## Best Practices

1. **Never commit `.env`** - It contains sensitive data
2. **Use strong passwords** - Generate with `openssl rand -hex 32`
3. **Document changes** - Update this guide when you modify config
4. **Test changes** - Use `make restart` after configuration changes
5. **Backup before changes** - `make backup` before major modifications
