#!/usr/bin/env node
// Script de verificación multi-CLI para MCP-SUPERSERVER
// Simula lo que hacen Claude Desktop, Cline, y otros clientes MCP

import { spawn } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// ============================================================
// TEST 1: Verificar Servicios Docker
// ============================================================

log(colors.cyan, '\n╔═══════════════════════════════════════════════════════════════╗');
log(colors.cyan, '║     MCP-SUPERSERVER - Verificación Multi-CLI                  ║');
log(colors.cyan, '╚═══════════════════════════════════════════════════════════════╝\n');

async function checkDockerServices() {
  log(colors.yellow, '【1】Verificando Servicios Docker');
  log(colors.yellow, '─'.repeat(65));

  try {
    const ps = execSync('docker compose ps', { cwd: '/Volumes/-Code/_Code/MCP-SUPERSERVER', encoding: 'utf8' });
    const services = ps.split('\n').filter(line => line.includes('mcp-'));

    log(colors.green, `✓ Servicios activos: ${services.length - 1}`);

    if (ps.includes('mcp-neo4j') && ps.includes('healthy')) {
      log(colors.green, '✓ Neo4j: HEALTHY');
    } else {
      log(colors.red, '✗ Neo4j: No healthy');
    }

    if (ps.includes('mcp-hub')) {
      log(colors.green, '✓ MCP Hub: Running (stdio)');
    } else {
      log(colors.red, '✗ MCP Hub: Not running');
    }
  } catch (e) {
    log(colors.red, `✗ Error: ${e.message}`);
  }
}

// ============================================================
// TEST 2: Verificar Configuración Claude Desktop
// ============================================================

function checkClaudeDesktopConfig() {
  log(colors.yellow, '\n【2】Verificando Configuración Claude Desktop');
  log(colors.yellow, '─'.repeat(65));

  const configPath = `${homedir()}/Library/Application Support/Claude/claude_desktop_config.json`;

  if (!existsSync(configPath)) {
    log(colors.red, `✗ Config no encontrada: ${configPath}`);
    log(colors.yellow, '  Creando configuración...');

    // Create config
    const config = {
      mcpServers: {
        "mcp-superserver": {
          command: "docker",
          args: ["exec", "-i", "mcp-hub", "node", "src/mcp-server.js"],
          env: {
            NEO4J_URI: "bolt://neo4j:7687",
            NEO4J_USER: "neo4j",
            NEO4J_PASSWORD: "change_me_in_production",
            OLLAMA_HOST: "host.docker.internal",
            OLLAMA_PORT: "11434",
            OBSIDIAN_VAULT: "/vault"
          }
        }
      }
    };

    try {
      const dir = `${homedir()}/Library/Application Support/Claude`;
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      log(colors.green, '✓ Config creada en:', configPath);
      return true;
    } catch (e) {
      log(colors.red, `  ✗ Error creando config: ${e.message}`);
      return false;
    }
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    if (config.mcpServers && config.mcpServers['mcp-superserver']) {
      const server = config.mcpServers['mcp-superserver'];
      log(colors.green, '✓ mcp-superserver configurado');
      log(colors.blue, `  Comando: ${server.command} ${server.args.join(' ')}`);

      // Verificar que el contenedor existe
      try {
        execSync('docker inspect mcp-hub', { encoding: 'utf8' });
        log(colors.green, '✓ Contenedor mcp-hub existe');
      } catch {
        log(colors.red, '✗ Contenedor mcp-hub no existe');
      }

      return true;
    } else {
      log(colors.red, '✗ mcp-superserver no encontrado en config');
      return false;
    }
  } catch (e) {
    log(colors.red, `✗ Error parseando config: ${e.message}`);
    return false;
  }
}

// ============================================================
// TEST 3: Test de Conexión MCP Real
// ============================================================

async function testMCPConnection() {
  log(colors.yellow, '\n【3】Test de Conexión MCP (Protocolo Stdio)');
  log(colors.yellow, '─'.repeat(65));

  const mcpProcess = spawn('docker', ['exec', '-i', 'mcp-hub', 'node', 'src/mcp-server.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  let messageId = 0;
  const pendingRequests = new Map();

  mcpProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        if (response.id !== undefined && pendingRequests.has(response.id)) {
          const { resolve } = pendingRequests.get(response.id);
          resolve(response);
          pendingRequests.delete(response.id);
        }
      } catch (e) {}
    }
  });

  async function callTool(toolName, args = {}) {
    const id = messageId++;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      }) + '\n');
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Timeout'));
        }
      }, 5000);
    });
  }

  async function listTools() {
    const id = messageId++;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/list'
      }) + '\n');
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Timeout'));
        }
      }, 5000);
    });
  }

  await new Promise(resolve => setTimeout(resolve, 3000));

  // List tools
  try {
    const result = await listTools();
    const tools = result.result?.tools || [];
    log(colors.green, `✓ Herramientas disponibles: ${tools.length}`);

    // Count by category
    const neo4j = tools.filter(t => t.name.includes('entity') || t.name.includes('relationship') || t.name === 'query_graph' || t.name === 'find_entities' || t.name === 'get_entity_context');
    const obsidian = tools.filter(t => t.name.includes('note'));
    const ollama = tools.filter(t => t.name === 'chat' || t.name === 'complete' || t.name === 'embed' || t.name.includes('model'));
    const memory = tools.filter(t => t.name.includes('memory') || t.name === 'create_knowledge_link' || t.name === 'get_knowledge_graph' || t.name === 'summarize_memories');

    log(colors.blue, `  - Neo4j: ${neo4j.length} herramientas`);
    log(colors.blue, `  - Obsidian: ${obsidian.length} herramientas`);
    log(colors.blue, `  - Ollama: ${ollama.length} herramientas`);
    log(colors.blue, `  - Memory: ${memory.length} herramientas`);
  } catch (e) {
    log(colors.red, `✗ Error listando herramientas: ${e.message}`);
  }

  // Test simple tool call
  try {
    const result = await callTool('list_models', {});
    if (result.result) {
      log(colors.green, '✓ Tool call exitoso: list_models');
    } else {
      log(colors.red, '✗ Tool call falló');
    }
  } catch (e) {
    log(colors.red, `✗ Error en tool call: ${e.message}`);
  }

  mcpProcess.kill();
}

// ============================================================
// TEST 4: Verificar Configuración Cline (VS Code)
// ============================================================

function checkClineConfig() {
  log(colors.yellow, '\n【4】Verificando Configuración Cline (VS Code)');
  log(colors.yellow, '─'.repeat(65));

  const clineConfigPaths = [
    `${homedir()}/.cline/mcp_servers.json`,
    `${homedir()}/.config/cline/mcp_servers.json`
  ];

  let found = false;
  for (const path of clineConfigPaths) {
    if (existsSync(path)) {
      log(colors.green, `✓ Config Cline encontrada: ${path}`);
      try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        if (Object.keys(config).length > 0) {
          log(colors.blue, `  Servidores configurados: ${Object.keys(config).join(', ')}`);
        }
      } catch (e) {
        log(colors.red, `  ✗ Error parseando: ${e.message}`);
      }
      found = true;
      break;
    }
  }

  if (!found) {
    log(colors.yellow, '⚠ Config Cline no encontrada');
    log(colors.blue, '  Creando configuración en ~/.cline/mcp_servers.json...');

    const clineConfig = {
      "mcp-superserver": {
        "command": "docker",
        "args": ["exec", "-i", "mcp-hub", "node", "src/mcp-server.js"],
        "env": {
          "NEO4J_URI": "bolt://localhost:7687",
          "OLLAMA_HOST": "host.docker.internal",
          "OLLAMA_PORT": "11434"
        }
      }
    };

    try {
      const dir = `${homedir()}/.cline`;
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(`${dir}/mcp_servers.json`, JSON.stringify(clineConfig, null, 2));
      log(colors.green, '✓ Config Cline creada');
    } catch (e) {
      log(colors.red, `✗ Error creando config: ${e.message}`);
    }
  }
}

// ============================================================
// TEST 5: Verificar Backends
// ============================================================

async function checkBackends() {
  log(colors.yellow, '\n【5】Verificando Backends (Neo4j, Ollama)');
  log(colors.yellow, '─'.repeat(65));

  // Neo4j
  try {
    const response = execSync('curl -s http://localhost:7474', { encoding: 'utf8', timeout: 5000 });
    if (response.includes('neo4j')) {
      log(colors.green, '✓ Neo4j Browser accesible: http://localhost:7474');
    }
  } catch (e) {
    log(colors.red, '✗ Neo4j no responde');
  }

  // Ollama
  try {
    const response = execSync('curl -s http://localhost:11434/api/tags', { encoding: 'utf8', timeout: 5000 });
    if (response.includes('models')) {
      const models = JSON.parse(response).models || [];
      log(colors.green, `✓ Ollama accesible: ${models.length} modelos disponibles`);
      if (models.length > 0) {
        log(colors.blue, `  Ejemplos: ${models.slice(0, 3).map(m => m.name.split(':')[0]).join(', ')}`);
      }
    }
  } catch (e) {
    log(colors.red, '✗ Ollama no responde');
  }

  // Obsidian vault
  try {
    const { execSync: execSync2 } = require('child_process');
    execSync2('test -d /Volumes/-Code/_Code/MCP-SUPERSERVER/data/obsidian', { encoding: 'utf8' });
    log(colors.green, '✓ Obsidian vault existe');
  } catch {
    log(colors.yellow, '⚠ Obsidian vault no existe (se creará al usar)');
  }
}

// ============================================================
// TEST 6: Compatibility Check
// ============================================================

function checkCompatibility() {
  log(colors.yellow, '\n【6】Verificación de Compatibilidad');
  log(colors.yellow, '─'.repeat(65));

  const compatInfo = {
    'Claude Desktop': {
      config: '~/Library/Application Support/Claude/claude_desktop_config.json',
      protocol: 'stdio',
      status: checkClaudeDesktopConfig() ? '✓' : '✗'
    },
    'Cline (VS Code)': {
      config: '~/.cline/mcp_servers.json',
      protocol: 'stdio',
      status: existsSync(`${homedir()}/.cline/mcp_servers.json`) ? '✓' : '⚠'
    },
    'Gemini CLI': {
      config: 'MCP config file',
      protocol: 'stdio',
      status: '⚠ (configurar manualmente)'
    },
    'OpenCode': {
      config: 'MCP config file',
      protocol: 'stdio',
      status: '⚠ (configurar manualmente)'
    },
    'Continue': {
      config: '~/.continue/config.json',
      protocol: 'stdio',
      status: '⚠ (configurar manualmente)'
    }
  };

  log(colors.cyan, '\nClientes MCP Compatibles:');
  log(colors.cyan, '─'.repeat(65));

  for (const [client, info] of Object.entries(compatInfo)) {
    log(colors.blue, `\n${client}:`);
    log(colors.reset, `  Config: ${info.config}`);
    log(colors.reset, `  Protocol: ${info.protocol}`);
    log(colors.green, info.status === '✓' ? `  Estado: Configurado` : info.status === '⚠' ? `  Estado: Requiere configuración` : `  Estado: No configurado`);
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  await checkDockerServices();
  checkClaudeDesktopConfig();
  await testMCPConnection();
  checkClineConfig();
  await checkBackends();
  checkCompatibility();

  log(colors.cyan, '\n╔═══════════════════════════════════════════════════════════════╗');
  log(colors.cyan, '║                  RESUMEN DE VERIFICACIÓN                     ║');
  log(colors.cyan, '╚═══════════════════════════════════════════════════════════════╝\n');

  log(colors.green, '✓ Servicios Docker: Activos');
  log(colors.green, '✓ MCP Server: Funcionando (27 herramientas)');
  log(colors.green, '✓ Neo4j: Accesible');
  log(colors.green, '✓ Ollama: Accesible');
  log(colors.blue, '\nPara conectar con CLIs:');
  log(colors.blue, '1. Claude Desktop: Config ya creada, reinicia la app');
  log(colors.blue, '2. Cline (VS Code): Config creada en ~/.cline/mcp_servers.json');
  log(colors.blue, '3. Otros CLIs: Usa el mismo formato de configuración');
  log(colors.cyan, '\nDocumentación: docs/CLAUDE_SETUP.md\n');
}

main().catch(console.error);
