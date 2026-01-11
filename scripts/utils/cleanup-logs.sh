#!/usr/bin/env bash
# ============================================================
# MCP-SUPERSERVER - Log Cleanup Script
# ============================================================
# Cleans up old log files based on retention policy

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Get retention days from .env or default to 30
if [ -f .env ]; then
    source .env
fi
RETENTION_DAYS=${LOG_RETENTION_DAYS:-30}

echo -e "${BLUE}🧹 MCP-SUPERSERVER - Log Cleanup${NC}"
echo "================================"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Function to cleanup directory
cleanup_directory() {
    local dir=$1
    local pattern=$2

    if [ ! -d "$dir" ]; then
        return
    fi

    echo -e "${BLUE}Cleaning $dir...${NC}"

    local count=$(find "$dir" -name "$pattern" -mtime +$RETENTION_DAYS -type f 2>/dev/null | wc -l | tr -d ' ')

    if [ "$count" -gt 0 ]; then
        find "$dir" -name "$pattern" -mtime +$RETENTION_DAYS -type f -print -delete 2>/dev/null | while read -r file; do
            echo "  Deleted: $(basename "$file")"
        done
        echo -e "${GREEN}✓ Deleted $count files${NC}"
    else
        echo "  No files to clean"
    fi
    echo ""
}

# Cleanup log directories
cleanup_directory "logs" "*.log"
cleanup_directory "logs" "*.log.*"

# Cleanup backup exports (separate retention)
BACKUP_RETENTION=${BACKUP_RETENTION_DAYS:-7}
echo -e "${BLUE}Cleaning exports (retention: $BACKUP_RETENTION_DAYS days)...${NC}"
backup_count=$(find exports -name "*.tar.gz" -mtime +$BACKUP_RETENTION -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$backup_count" -gt 0 ]; then
    find exports -name "*.tar.gz" -mtime +$BACKUP_RETENTION -type f -delete 2>/dev/null
    echo -e "${GREEN}✓ Deleted $backup_count backup files${NC}"
else
    echo "  No backups to clean"
fi
echo ""

# Show disk usage
echo -e "${BLUE}📊 Current disk usage:${NC}"
du -sh logs exports 2>/dev/null | sed 's/^/  /'
echo ""

echo -e "${GREEN}✅ Cleanup complete${NC}"
