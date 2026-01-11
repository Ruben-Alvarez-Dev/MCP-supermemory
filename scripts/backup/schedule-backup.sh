#!/usr/bin/env sh
# ============================================================
# MCP-SUPERSERVER - Backup Scheduler
# ============================================================
# Runs scheduled backups based on cron schedule

# Get schedule from environment or default to daily at 2 AM
SCHEDULE="${BACKUP_SCHEDULE:-0 2 * * *}"

# Get retention days
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

echo "Backup Scheduler"
echo "================"
echo "Schedule: $SCHEDULE"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Function to run backup
run_backup() {
    echo "Running backup at $(date)"
    /scripts/create-backup.sh
    echo ""
}

# If first argument is "now" or "run", execute immediately
if [ "$1" = "now" ] || [ "$1" = "run" ]; then
    run_backup
    exit 0
fi

# Parse cron schedule and calculate next run time
# For simplicity, we'll just run once and exit
# In production, use a proper cron daemon

echo "Scheduler mode: single run"
echo "Use docker exec to trigger manual backups:"
echo "  docker exec mcp-backup-scheduler /scripts/schedule-backup.sh run"
echo ""

# Run backup once on startup
run_backup

# Keep container alive
echo "Scheduler waiting..."
tail -f /dev/null
