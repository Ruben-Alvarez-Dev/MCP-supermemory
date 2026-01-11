#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Backup Script
# ============================================================
# Creates timestamped backups of all data and configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BACKUP_DIR="./exports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="mcp-superserver-backup-${TIMESTAMP}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# Get retention days from .env or default to 7
if [ -f .env ]; then
    source .env
fi
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

echo -e "${BLUE}💾 MCP-SUPERSERVER - Backup${NC}"
echo "================================"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}📁 Creating backup in ${TEMP_DIR}...${NC}"

# Copy data directories
echo -e "${BLUE}📦 Copying data...${NC}"
cp -r data "$TEMP_DIR/" 2>/dev/null || echo -e "${YELLOW}⚠️  No data directory yet${NC}"

# Copy configuration
echo -e "${BLUE}📋 Copying configuration...${NC}"
cp -r config "$TEMP_DIR/" 2>/dev/null || echo -e "${YELLOW}⚠️  No config directory yet${NC}"

# Copy logs (optional, can be large)
if [ "${BACKUP_INCLUDE_LOGS:-false}" = "true" ]; then
    echo -e "${BLUE}📋 Copying logs...${NC}"
    cp -r logs "$TEMP_DIR/" 2>/dev/null || true
fi

# Copy .env file
if [ -f .env ]; then
    echo -e "${BLUE}📋 Copying environment file...${NC}"
    cp .env "$TEMP_DIR/"
fi

# Copy docker-compose.yml
if [ -f docker-compose.yml ]; then
    echo -e "${BLUE}📋 Copying docker-compose.yml...${NC}"
    cp docker-compose.yml "$TEMP_DIR/"
fi

# Create metadata
echo -e "${BLUE}📋 Creating metadata...${NC}"
cat > "$TEMP_DIR/backup-metadata.json" << EOF
{
  "version": "1.0.0",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "user": "$(whoami)",
  "docker_version": "$(docker --version)",
  "git_commit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
  "backup_retention_days": $RETENTION_DAYS
}
EOF

# Compress backup
echo -e "${BLUE}🗜️  Compressing...${NC}"
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .

# Calculate size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

# Create symlink to latest
ln -sf "$BACKUP_NAME.tar.gz" "$BACKUP_DIR/LATEST_BACKUP"

# Cleanup temporary directory
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Backup completed: $BACKUP_FILE ($SIZE)${NC}"

# Clean old backups
echo -e "${BLUE}🧹 Cleaning old backups (older than ${RETENTION_DAYS} days)...${NC}"
DELETED=$(find "$BACKUP_DIR" -name "mcp-superserver-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo -e "${GREEN}✅ Deleted ${DELETED} old backup(s)${NC}"

echo ""
echo -e "${GREEN}✨ Backup complete!${NC}"
echo "   Location: $BACKUP_FILE"
echo "   Latest: ${BACKUP_DIR}/LATEST_BACKUP -> $(readlink ${BACKUP_DIR}/LATEST_BACKUP)"
