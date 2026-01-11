# MCP-SUPERSERVER Architecture

## System Overview

MCP-SUPERSERVER is a unified AI memory and reasoning hub built on Docker Compose, providing a shared brain for multiple AI CLIs.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLI CONSUMERS                                  │
│  Claude Code | Gemini CLI | Cline | Cursor | OpenCode | Qwen CLI         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        WANAKU MCP ROUTER                                │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  MIDDLEWARE LAYER                                                 │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐   │ │
│  │  │ Auto Logging  │  │ Observability │  │ Model Routing      │   │ │
│  │  │ (Structured)  │  │(Prometheus)   │  │ (Task-based)       │   │ │
│  │  └───────────────┘  └───────────────┘  └─────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │   MCP SERVERS    │  │   MCP SERVERS    │  │   MCP SERVERS    │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │     BACKENDS     │  │     BACKENDS     │  │     BACKENDS     │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Component Deep Dive

### 1. MCP Router (Wanaku-based)

**Purpose**: Central entry point for all MCP communications

**Responsibilities**:
- Route tool calls to appropriate MCP servers
- Apply middleware (logging, observability)
- Manage server lifecycle
- Provide health endpoints

**Technology**: Node.js + Express + MCP SDK

**Configuration**: `config/mcp-hub.json`

### 2. Middleware Layer

#### Auto-Logging Middleware

**Purpose**: Force structured logging for all AI actions

**Flow**:
```
AI Action → Intercept → Format Structured Log → Write to Obsidian + Neo4j → Continue
```

**Schema**: `config/schemas/log-entry.schema.json`

**Enforcement**: Protocol Omega v2.0

#### Observability Middleware

**Purpose**: Track metrics and performance

**Metrics Collected**:
- Tool call counts by type
- Response times
- Error rates
- Token usage (if available)

**Export**: Prometheus format on port 9090

#### Model Routing Middleware

**Purpose**: Route to appropriate Ollama model based on task type

**Categories**:
- `reasoning`: qwq, deepseek-r1 → complex logic
- `coding`: codellama, deepseek-coder → code generation
- `vision`: llava → image analysis
- `chat`: llama3.3, mistral → general conversation
- `embeddings`: nomic-embed-text → vector embeddings

### 3. Memory Backends

#### Neo4j (Structured Memory)

**Schema**:
```cypher
(:Project)-[:CONTAINS]->(:File)
(:File)-[:DEFINES]->(:Class)
(:Bug)-[:FIXED_IN]->(:Class)
(:Decision)-[:ABOUT]->(:Project)
(:Session)-[:RECORDED_IN]->(:LogEntry)
```

**Query Patterns**:
- Project context: `MATCH (p:Project {name: $name})-[:CONTAINS*]->(n) RETURN p, n`
- Recent activity: `MATCH (l:LogEntry) RETURN l ORDER BY l.timestamp DESC LIMIT 10`
- Entity search: `MATCH (n {name: $name}) RETURN n`

**Constraints**:
- No chronological logs in Neo4j
- Structured data only (entities + relationships)
- Cross-references to Obsidian logs

#### Obsidian (Logs & Documentation)

**Structure**:
```
/data/obsidian/
├── AI_Logs/
│   └── Log_Global_YYYY-MM-DD.md    # Daily activity logs
└── AI_Memory/
    ├── Proyectos/{project}.md        # Project-specific notes
    ├── Decisiones/{date}_{topic}.md  # Decisions made
    └── Conocimiento/{topic}.md       # Knowledge base
```

**Format**: Markdown with YAML frontmatter

**Cross-references**: Links to Neo4j entity IDs

### 4. Model Mesh (Ollama)

**Discovery**:
- Automatic model detection on startup
- Periodic refresh (default: 30 min)
- Fallback to default model if unavailable

**Routing Strategy**:
1. User override (explicit "use X model")
2. Task-based routing (automatic by category)
3. Fallback model (if primary unavailable)

### 5. Protocol Omega (Governance)

**Enforcement**:
- Pre-action checks (Neo4j query required)
- Mandatory logging (action blocked if fails)
- Format validation (schema check)
- Post-action verification (Neo4j update)

**Penalties**:
- Action blocking if logging fails
- User notification on format errors
- Session timeout on repeated violations

## Data Flow

### Typical Request Flow

```
1. User (via CLI): "Fix the login bug"
                      │
2. MCP Router receives tool call
                      │
3. Middleware checks Protocol Omega compliance
                      │
4. Query Neo4j for project context
   └─→ Returns: auth_service.py exists, known issues
                      │
5. Execute action (modify code)
                      │
6. Middleware captures action details
                      │
7. Write to Obsidian (Log_Global_YYYY-MM-DD.md)
   └─→ Structured markdown entry
                      │
8. Update Neo4j (entities + relationships)
   └─→ (File)-[:MODIFIED]->(Bug)-[:FIXED]
                      │
9. Return result to CLI
```

### Memory Query Flow

```
1. CLI asks: "What did we work on yesterday?"
                      │
2. Router receives query
                      │
3. Query Neo4j: MATCH (p:Project)-[:RECORDED_IN]->(l:LogEntry)
                 WHERE l.date >= yesterday
                 RETURN l
                      │
4. Neo4j returns: LogEntry IDs with Obsidian refs
                      │
5. Read Obsidian: Log_Global_YYYY-MM-DD.md
                      │
6. Synthesize: "Yesterday you fixed the login bug..."
```

## Security Architecture

### Authentication

- Neo4j: username/password (env var)
- MCP Hub: optional API key (env var)
- Ollama: local only (no external access)

### Authorization

- CLI-level: Local execution only
- Network isolation: Docker bridge network
- Volume isolation: Separate data volumes

### Secrets Management

- Environment variables in `.env` (gitignored)
- No hardcoded credentials
- `.env.example` as template

### Network Security

- Services on isolated bridge network (172.28.0.0/16)
- Only exposed ports: 3000, 7474, 7687, 9090, 11434
- No inter-container communication outside network

## Scalability

### Vertical Scaling

- Neo4j: Increase `dbms.memory.heap.max_size`
- Ollama: GPU acceleration for models
- MCP Hub: Increase container limits

### Horizontal Scaling

- Multiple MCP Hub instances (load balanced)
- Neo4j clustering (CAUSAL consistency)
- Ollama: Single instance (local model serving)

## Performance Optimization

### Neo4j

- Index on frequently queried properties
- Connection pooling (default: 50 connections)
- Query result caching (5 min TTL)

### Ollama

- Model preloading on startup
- Model quantization for memory efficiency
- Batch inference when possible

### MCP Hub

- Async middleware processing
- Streaming responses for long operations
- Connection reuse

## Monitoring

### Metrics Collected

- Service health (uptime, response time)
- Tool call statistics (count, type, duration)
- Error rates (by service, by type)
- Resource usage (CPU, memory, disk)

### Dashboards

- Prometheus: http://localhost:9090
- Neo4j Browser: http://localhost:7474
- MCP Hub Health: http://localhost:3000/health

### Alerts

- Service down (health check fails)
- High error rate (>5%)
- Disk space low (<10%)
- Memory high (>90%)

## Disaster Recovery

### Backup Strategy

1. **Automated Daily**: Full backup at 2 AM
2. **Retention**: 7 days (configurable)
3. **Compression**: gzip (configurable)
4. **Location**: `/exports/` directory

### Recovery Procedure

1. Stop all services
2. Restore from `LATEST_BACKUP`
3. Verify data integrity
4. Restart services
5. Run health checks

### RPO/RTO

- RPO (Recovery Point Objective): 24 hours (last backup)
- RTO (Recovery Time Objective): ~5 minutes

## Development Workflow

### Local Development

```bash
# Start in dev mode
make dev

# Hot reload enabled
# Debug logging enabled
# Source mounted as volume
```

### Testing

```bash
# Unit tests
npm test

# Integration tests
make test

# E2E tests
docker-compose -f docker-compose.test.yml up
```

### Deployment

```bash
# Build production images
make build

# Start in production mode
make prod

# Or use existing images
make start
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Router | Node.js 20 + Express | MCP server orchestration |
| Graph DB | Neo4j 5.15 | Structured memory |
| Models | Ollama | Local LLM inference |
| Logs | Obsidian (Markdown) | Human-readable logs |
| Monitoring | Prometheus | Metrics collection |
| Container | Docker Compose | Service orchestration |
| Language | TypeScript/JavaScript | MCP Hub |
| Language | Python 3.12 | Some MCP servers |

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Ollama Documentation](https://ollama.com/)
- [Docker Compose](https://docs.docker.com/compose/)
