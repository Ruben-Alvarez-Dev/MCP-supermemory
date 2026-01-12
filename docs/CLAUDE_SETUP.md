# Conectar MCP-SUPERSERVER a Claude Code (y otros CLI)

## Opción 1: Usar Servidor MCP en Docker (RECOMENDADO)

Esta es la opción más simple ya que el servidor ya está corriendo.

### Pasos:

1. **Verificar que los servicios están corriendo:**
   ```bash
   cd /Volumes/-Code/_Code/MCP-SUPERSERVER
   docker compose ps
   ```

2. **El archivo de configuración ya está creado en:**
   ```
   ~/Library/Application Support/Claude/claude_desktop_config.json
   ```

3. **Reiniciar Claude Desktop:**
   - Cierra completamente Claude Desktop
   - Vuélvelo a abrir
   - Verifica que "mcp-superserver" aparece en la lista de servidores MCP

4. **Verificar conexión:**
   - Abre una nueva conversación en Claude
   - Deberías ver disponibles 27 herramientas del MCP-SUPERSERVER

## Opción 2: Modo Local (Fuera de Docker)

Si prefieres ejecutar el servidor MCP directamente en tu Mac:

### Pasos:

1. **Asegúrate de tener las dependencias:**
   ```bash
   cd /Volumes/-Code/_Code/MCP-SUPERSERVER/Docker/mcp-hub
   npm install
   ```

2. **Inicia el servidor MCP local:**
   ```bash
   # En una terminal separada
   cd /Volumes/-Code/_Code/MCP-SUPERSERVER/Docker/mcp-hub
   npm run start:mcp
   ```

3. **Usa la configuración local:**
   - Copia el contenido de `claude_local_config.json`
   - Pégalo en tu `claude_desktop_config.json`
   - Reinicia Claude Desktop

## Herramientas Disponibles

Una vez conectado, tendrás acceso a 27 herramientas organizadas en 4 categorías:

### 🗄️ Neo4j (7 herramientas)
- `create_entity` - Crear nodos en el grafo
- `update_entity` - Actualizar nodos existentes
- `delete_entity` - Eliminar nodos
- `create_relationship` - Crear relaciones entre nodos
- `query_graph` - Ejecutar queries Cypher
- `find_entities` - Buscar entidades
- `get_entity_context` - Obtener contexto de una entidad

### 📝 Obsidian (7 herramientas)
- `read_note` - Leer notas markdown
- `write_note` - Escribir notas
- `append_note` - Añadir contenido a notas
- `list_notes` - Listar notas disponibles
- `search_notes` - Buscar en notas
- `create_note` - Crear nuevas notas
- `delete_note` - Eliminar notas

### 🤖 Ollama (6 herramientas)
- `chat` - Chat con modelos de lenguaje
- `complete` - Completar texto
- `embed` - Generar embeddings
- `list_models` - Listar modelos disponibles
- `pull_model` - Descargar modelos
- `show_model_info` - Información de modelos

### 🧠 Memory (7 herramientas)
- `store_memory` - Almacenar recuerdos
- `recall_memory` - Recuperar recuerdos
- `create_knowledge_link` - Crear enlaces de conocimiento
- `get_knowledge_graph` - Obtener grafo de conocimiento
- `search_memories_by_date` - Buscar por fecha
- `update_memory_importance` - Actualizar importancia
- `summarize_memories` - Resumir memorias

## Solución de Problemas

### Si el servidor no aparece en Claude:

1. **Verifica que los servicios Docker están corriendo:**
   ```bash
   docker ps | grep mcp
   ```

2. **Verifica el log del servidor MCP:**
   ```bash
   docker logs mcp-hub
   ```

3. **Prueba el servidor manualmente:**
   ```bash
   docker exec -it mcp-hub node src/mcp-server.js
   ```

4. **Reinicia Claude Desktop completamente**

### Si ves errores de conexión:

1. **Verifica que Neo4j está healthy:**
   ```bash
   curl http://localhost:7474
   ```

2. **Verifica que Ollama está accesible:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

3. **Revisa la configuración en Claude Desktop**
   - Abre Preferences > MCP
   - Verifica que "mcp-superserver" esté listado
   - Revisa los logs de error

## Ejemplos de Uso

Una vez conectado, puedes usar las herramientas desde Claude:

```
Usuario: "Recuerda que estoy trabajando en el proyecto MCP-SUPERSERVER
y que mi email es test@example.com"

Claude usará: store_memory

---

Usuario: "¿Qué entidades relacionadas con 'MCP' tengo en mi grafo de conocimiento?"

Claude usará: query_graph o get_entity_context

---

Usuario: "Crea una nota en Obsidian con el resumen de nuestra sesión"

Claude usará: create_note

---

Usuario: "Lista los modelos de Ollama disponibles"

Claude usará: list_models
```

## Para Otros CLI (Cline, Gemini, etc.)

El formato de configuración es compatible con otros clientes MCP:

**Cline (VS Code):**
- Archivo: `~/.cline/mcp_servers.json`
- Usa el mismo formato JSON

**Otros clientes MCP:**
- Consulta la documentación específica de cada cliente
- El protocolo MCP es estándar, así que la configuración es similar
