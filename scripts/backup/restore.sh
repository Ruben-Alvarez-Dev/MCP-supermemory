#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Restore Script
# ============================================================
# Restores from a backup archive

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_usage() {
    echo "Usage: $0 <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh exports/*.tar.gz 2>/dev/null || echo "   No backups found"
    exit 1
}

if [ -z "$1" ]; then
    show_usage
fi

BACKUP_FILE="$1"

# Support LATEST_BACKUP symlink
if [ "$1" = "LATEST" ] || [ "$1" = "latest" ]; then
    BACKUP_FILE="exports/LATEST_BACKUP"
    if [ -L "$BACKUP_FILE" ]; then
        BACKUP_FILE="$(readlink -f "$BACKUP_FILE")"
    fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup not found: $BACKUP_FILE${NC}"
    show_usage
fi

echo -e "${BLUE}♻️  MCP-SUPERSERVER - Restore${NC}"
echo "================================"
echo "Backup: $BACKUP_FILE"
echo ""

# Show backup metadata if available
echo -e "${BLUE}📋 Backup information:${NC}"
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR" backup-metadata.json 2>/dev/null || true
if [ -f "$TEMP_DIR/backup-metadata.json" ]; then
    cat "$TEMP_DIR/backup-metadata.json" | jq -r '
        "  Date: \(.timestamp)",
        "  Host: \(.hostname)",
        "  User: \(.user)",
        "  Version: \(.version)"
    ' 2>/dev/null || echo "  (metadata unreadable)"
fi
rm -rf "$TEMP_DIR"
echo ""

# Confirm
echo -e "${YELLOW}⚠️  This will OVERWRITE all current data!${NC}"
read -p "Are you sure? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Cancelled${NC}"
    exit 1
fi

# Stop services
echo -e "${BLUE}⏹️  Stopping services...${NC}"
if [ -f Makefile ]; then
    make stop > /dev/null 2>&1 || docker-compose stop > /dev/null 2>&1
else
    docker-compose stop > /dev/null 2>&1
fi

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}📁 Extracting backup...${NC}"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore data
echo -e "${BLUE}♻️  Restoring data...${NC}"
if [ -d "$TEMP_DIR/data" ]; then
    rm -rf data
    cp -r "$TEMP_DIR/data" .
fi

# Restore configuration
echo -e "${BLUE}♻️  Restoring configuration...${NC}"
if [ -d "$TEMP_DIR/config" ]; then
    rm -rf config
    cp -r "$TEMP_DIR/config" .
fi

# Restore .env
if [ -f "$TEMP_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  Restoring .env (may have different passwords)${NC}"
    cp "$TEMP_DIR/.env" .
fi

# Restore docker-compose.yml
if [ -f "$TEMP_DIR/docker-compose.yml" ]; then
    cp "$TEMP_DIR/docker-compose.yml" .
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Start services
echo -e "${BLUE}🚀 Starting services...${NC}"
if [ -f Makefile ]; then
    make start > /dev/null 2>&1
else
    docker-compose up -d > /dev/null 2>&1
fi

echo -e "${GREEN}✅ Restore completed!${NC}"
echo ""
echo "📊 Next steps:"
echo "   - Verify services are running: make status"
echo "   - Check logs: make logs"
echo "   - Review .env if passwords changed"
