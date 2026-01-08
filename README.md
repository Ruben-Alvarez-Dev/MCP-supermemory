# MCP-SUPERSERVER

<div align="center">

**Unified AI Memory and Reasoning Hub**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Compose](https://img.shields.io/badge/Docker%20Compose-Ready-blue.svg)](https://docs.docker.com/compose/)

</div>

## 🎯 Overview

MCP-SUPERSERVER is a unified, containerized AI hub that provides:

- **Shared Memory**: Neo4j graph database + Obsidian markdown logs
- **Model Mesh**: Ollama integration with automatic model routing
- **MCP Router**: Wanaku-based router with middleware for logging and observability
- **Multi-CLI Support**: Works with Claude Code, Gemini CLI, Cline, OpenCode, Qwen CLI, and more
- **Backup/Restore**: Automated backup system with disaster recovery
- **One-Command Deployment**: Single `make install` to get everything running

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLI CONSUMERS                                │
│  Claude Code • Gemini CLI • Cline • OpenCode • Qwen CLI        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              WANAKU MCP ROUTER (Middleware)                     │
│  • Auto-logging (JSON + Markdown)                               │
│  • Model routing (Ollama mesh)                                  │
│  • OpenTelemetry observability                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP HUB (Servers)                            │
│  mem0 • neo4j-memory • mem-agent • sequential-thinking          │
│  task-master • software-planning • ollama-mcp • conductor       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKENDS (Docker)                            │
│  Neo4j (Graph DB) • Ollama (Models) • Obsidian (Logs)           │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/rubenalvarezdev/mcp-superserver.git
cd mcp-superserver

# Install and start
make install

# Check status
make status
```

## 📋 Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 16GB+ RAM recommended
- 50GB+ disk space

## 📁 Project Structure

```
MCP-SUPERSERVER/
├── docker-compose.yml          # Main orchestration
├── Makefile                    # Command shortcuts
├── .env                        # Environment variables
├── Docker/                     # Custom Docker images
├── mcp-servers/                # MCP server implementations
├── config/                     # Configuration files
├── data/                       # Persistent data (backed up)
├── scripts/                    # Installation and maintenance
├── docs/                       # Documentation
└── exports/                    # Backup archives
```

## 🛠️ Commands

```bash
make help       # Show all available commands
make install    # Install and configure everything
make start      # Start all services
make stop       # Stop all services
make status     # Show service status
make logs       # View logs
make backup     # Create backup
make restore    # Restore from backup
make export     # Export portable package
```

## 📚 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [Configuration Guide](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Backup & Restore](docs/BACKUP_RESTORE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🔧 Configuration

All configuration is centralized in:

- `.env` - Environment variables
- `config/mcp-hub.json` - MCP Hub configuration
- `config/protocol-omega.md` - AI governance protocol

## 💾 Backup & Restore

```bash
# Automatic daily backups at 2 AM
make backup

# Manual backup
./scripts/backup/create-backup.sh

# Restore from latest
make restore
```

## 🧪 Development

```bash
# Development mode with hot reload
make dev

# Run tests
make test

# Build images
make build
```

## 📊 Monitoring

- **Prometheus**: http://localhost:9090
- **Neo4j Browser**: http://localhost:7474
- **MCP Hub API**: http://localhost:3000

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Wanaku MCP Router
- Model Context Protocol
- Neo4j
- Ollama

---

<div align="center">

**Built with ❤️ for unified AI development**

</div>
