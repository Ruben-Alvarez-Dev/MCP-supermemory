# ============================================================
# MCP-SUPERSERVER - Makefile
# ============================================================
# Command shortcuts for common operations

.PHONY: help install start stop restart status backup restore logs clean deep-clean test dev prod update export import
.DEFAULT_GOAL := help

# Colors for terminal output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo '$(BLUE)MCP-SUPERSERVER - Comandos disponibles:$(NC)'
	@echo ''
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ''

install: ## Install and configure MCP-SUPERSERVER
	@echo '$(BLUE)📦 Instalando MCP-SUPERSERVER...$(NC)'
	@if [ -f .env ]; then \
		echo '$(YELLOW)⚠️  .env ya existe. Omitiendo creación.$(NC)'; \
	else \
		cp .env.example .env; \
		echo '$(YELLOW)⚠️  .env creado desde plantilla. Edítalo para cambiar contraseñas.$(NC)'; \
	fi
	@./scripts/install.sh

start: ## Start all services
	@echo '$(BLUE)🚀 Arrancando servicios...$(NC)'
	@docker-compose up -d
	@echo '$(GREEN)✅ Servicios arrancados$(NC)'
	@make status

stop: ## Stop all services
	@echo '$(BLUE)⏹️  Parando servicios...$(NC)'
	@docker-compose stop
	@echo '$(GREEN)✅ Servicios parados$(NC)'

restart: stop start ## Restart all services

status: ## Show status of all services
	@echo '$(BLUE)📊 Estado de los servicios:$(NC)'
	@docker-compose ps
	@echo ''
	@if [ -f scripts/health-check.sh ]; then \
		./scripts/health-check.sh; \
	fi

logs: ## Show logs from all services (follow mode)
	@docker-compose logs -f

logs-neo4j: ## Show Neo4j logs
	@docker-compose logs -f neo4j

logs-ollama: ## Show Ollama logs
	@docker-compose logs -f ollama

logs-mcp-hub: ## Show MCP Hub logs
	@docker-compose logs -f mcp-hub

backup: ## Create backup of all data
	@echo '$(BLUE)💾 Creando backup...$(NC)'
	@./scripts/backup/create-backup.sh

restore: ## Restore from latest backup
	@echo '$(BLUE)♻️  Restaurando backup...$(NC)'
	@./scripts/backup/restore.sh ./exports/LATEST_BACKUP

clean: ## Clean up logs and temporary files
	@echo '$(BLUE)🧹 Limpiando...$(NC)'
	@if [ -f scripts/utils/cleanup-logs.sh ]; then \
		./scripts/utils/cleanup-logs.sh; \
	fi

deep-clean: ## Stop, clean and remove volumes (DESTROYS ALL DATA)
	@echo '$(RED)⚠️  Esto eliminará TODOS los datos. Continuar? [y/N] $(NC)'
	@read -r response; \
	if [ "$$response" = "y" ]; then \
		docker-compose down -v; \
		echo '$(GREEN)✅ Volúmenes eliminados$(NC)'; \
	else \
		echo '$(YELLOW)❌ Cancelado$(NC)'; \
	fi

test: ## Run all tests
	@echo '$(BLUE)🧪 Ejecutando tests...$(NC)'
	@if [ -f docker-compose.test.yml ]; then \
		docker-compose -f docker-compose.test.yml up --abort-on-container-exit; \
	else \
		echo '$(YELLOW)⚠️  No hay tests configurados$(NC)'; \
	fi

dev: ## Start in development mode
	@echo '$(BLUE)🔧 Modo desarrollo...$(NC)'
	@if [ -f docker-compose.dev.yml ]; then \
		docker-compose -f docker-compose.yml -f docker-compose.dev.yml up; \
	else \
		docker-compose up; \
	fi

prod: ## Start in production mode
	@echo '$(BLUE)🚀 Modo producción...$(NC)'
	@if [ -f docker-compose.prod.yml ]; then \
		docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d; \
	else \
		docker-compose up -d; \
	fi

update: ## Update all Docker images
	@echo '$(BLUE)🔄 Actualizando imágenes...$(NC)'
	@docker-compose pull
	@make restart

export: ## Export package for distribution
	@echo '$(BLUE)📦 Empaquetando...$(NC)'
	@tar -czf ../mcp-superserver-$$(date +%Y%m%d-%H%M%S).tar.gz \
		--exclude='data/*' \
		--exclude='exports/*' \
		--exclude='logs/*' \
		--exclude='.git' \
		.
	@echo '$(GREEN)✅ Paquete creado$(NC)'

import: ## Import package
	@echo '$(BLUE)📥 Importando paquete...$(NC)'
	@read -p "Ruta del paquete: " package; \
	tar -xzf $$package
	@echo '$(GREEN)✅ Paquete importado$(NC)'

build: ## Build all Docker images
	@echo '$(BLUE)🐳 Construyendo imágenes...$(NC)'
	@docker-compose build

rebuild: ## Force rebuild all images
	@echo '$(BLUE)🐳 Reconstruyendo imágenes...$(NC)'
	@docker-compose build --no-cache
