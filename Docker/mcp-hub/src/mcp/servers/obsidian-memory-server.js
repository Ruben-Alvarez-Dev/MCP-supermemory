// ============================================================
// Obsidian Memory MCP Server
// ============================================================
// Task: US-009 - MCP Server for Obsidian vault access
// Description: Read and write markdown files in Obsidian vault

import { BaseMCPServer, createTool, createInputSchema } from '../base-server.js';
import {
  readLogFile,
  writeMarkdown,
  getLogFiles,
  searchByText
} from '../../services/obsidian-writer.js';
import { logger } from '../../utils/logger.js';
import { createModuleLogger } from '../../utils/log-helpers.js';
import fs from 'fs/promises';
import path from 'path';

const serverLogger = createModuleLogger('ObsidianMemoryServer');

/**
 * Obsidian Memory MCP Server
 * Provides tools for accessing Obsidian vault
 */
export class ObsidianMemoryServer extends BaseMCPServer {
  constructor(config = {}) {
    super({
      name: 'obsidian-memory',
      version: '1.0.0',
      description: 'MCP server for Obsidian vault operations',
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.vaultPath = config.vaultPath || process.env.OBSIDIAN_VAULT_PATH || '/app/obsidian-vault';
    this.logsFolder = config.logsFolder || process.env.OBSIDIAN_LOGS_FOLDER || 'MCP Logs';

    this.registerTools();
    this.registerResources();
  }

  /**
   * Register all Obsidian tools
   */
  registerTools() {
    // Read note tool
    this.registerTool(createTool(
      'read_note',
      'Read a markdown note from the Obsidian vault',
      createInputSchema({
        filename: {
          type: 'string',
          description: 'Name of the markdown file (e.g., 2024-01-15.md)'
        }
      }, ['filename']),
      async (args) => {
        const { filename } = args;

        serverLogger.info('Reading note', { filename });

        try {
          const content = await readLogFile(filename);

          // Parse YAML frontmatter if present
          const lines = content.split('\n');
          let frontmatter = null;
          let bodyStart = 0;

          if (lines[0] === '---') {
            const endIdx = lines.indexOf('---', 1);
            if (endIdx > 0) {
              const yamlText = lines.slice(1, endIdx).join('\n');
              frontmatter = this.parseYamlFrontmatter(yamlText);
              bodyStart = endIdx + 1;
            }
          }

          const body = lines.slice(bodyStart).join('\n').trim();

          return {
            success: true,
            filename,
            frontmatter,
            body,
            content
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Write note tool
    this.registerTool(createTool(
      'write_note',
      'Write or overwrite a markdown note in the Obsidian vault',
      createInputSchema({
        filename: {
          type: 'string',
          description: 'Name of the markdown file'
        },
        content: {
          type: 'string',
          description: 'Markdown content'
        },
        frontmatter: {
          type: 'object',
          description: 'YAML frontmatter properties',
          additionalProperties: true
        }
      }, ['filename', 'content']),
      async (args) => {
        const { filename, content, frontmatter } = args;

        serverLogger.info('Writing note', { filename });

        try {
          let fullContent = content;

          if (frontmatter) {
            fullContent = this.formatYamlFrontmatter(frontmatter) + '\n\n' + content;
          }

          await writeMarkdown(filename, fullContent, frontmatter || {});

          return {
            success: true,
            filename,
            message: 'Note written successfully'
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Append to note tool
    this.registerTool(createTool(
      'append_note',
      'Append content to an existing markdown note',
      createInputSchema({
        filename: {
          type: 'string',
          description: 'Name of the markdown file'
        },
        content: {
          type: 'string',
          description: 'Content to append'
        }
      }, ['filename', 'content']),
      async (args) => {
        const { filename, content } = args;

        serverLogger.info('Appending to note', { filename });

        try {
          const existing = await readLogFile(filename);
          const updated = existing + '\n\n' + content;

          await writeMarkdown(filename, updated, {});

          return {
            success: true,
            filename,
            message: 'Content appended successfully'
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // List notes tool
    this.registerTool(createTool(
      'list_notes',
      'List all markdown notes in the vault',
      createInputSchema({
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return',
          default: 100
        },
        sort: {
          type: 'string',
          description: 'Sort order (newest or oldest)',
          enum: ['newest', 'oldest'],
          default: 'newest'
        }
      }, []),
      async (args) => {
        const { limit = 100, sort = 'newest' } = args;

        serverLogger.info('Listing notes', { limit, sort });

        try {
          let files = await getLogFiles();

          // Already sorted newest first by default
          if (sort === 'oldest') {
            files = files.reverse();
          }

          files = files.slice(0, limit);

          return {
            success: true,
            count: files.length,
            notes: files
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Search notes tool
    this.registerTool(createTool(
      'search_notes',
      'Search for notes by filename or content',
      createInputSchema({
        query: {
          type: 'string',
          description: 'Search query'
        },
        searchContent: {
          type: 'boolean',
          description: 'Whether to search within file contents',
          default: false
        }
      }, ['query']),
      async (args) => {
        const { query, searchContent = false } = args;

        serverLogger.info('Searching notes', { query, searchContent });

        try {
          const files = await getLogFiles();

          // Filter by filename
          let results = files.filter(f =>
            f.toLowerCase().includes(query.toLowerCase())
          );

          if (searchContent && results.length < 50) {
            // Also search content for limited results
            const contentResults = [];
            for (const file of files) {
              if (contentResults.length >= 20) break;

              try {
                const content = await readLogFile(file);
                if (content.toLowerCase().includes(query.toLowerCase())) {
                  if (!results.includes(file)) {
                    contentResults.push(file);
                  }
                }
              } catch (e) {
                // Skip files that can't be read
              }
            }
            results = [...new Set([...results, ...contentResults])];
          }

          return {
            success: true,
            count: results.length,
            notes: results
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Create note tool
    this.registerTool(createTool(
      'create_note',
      'Create a new markdown note with timestamp and optional frontmatter',
      createInputSchema({
        title: {
          type: 'string',
          description: 'Note title (used for filename if not provided)'
        },
        content: {
          type: 'string',
          description: 'Markdown content'
        },
        filename: {
          type: 'string',
          description: 'Custom filename (optional)'
        },
        frontmatter: {
          type: 'object',
          description: 'YAML frontmatter properties',
          additionalProperties: true
        },
        tags: {
          type: 'array',
          description: 'Tags to add',
          items: { type: 'string' }
        }
      }, ['title', 'content']),
      async (args) => {
        const { title, content, filename, frontmatter = {}, tags = [] } = args;

        serverLogger.info('Creating note', { title });

        try {
          // Generate filename if not provided
          const noteFilename = filename || this.generateFilename(title);

          // Build frontmatter
          const finalFrontmatter = {
            title,
            date: new Date().toISOString(),
            created: new Date().toISOString(),
            ...frontmatter
          };

          if (tags.length > 0) {
            finalFrontmatter.tags = tags;
          }

          const fullContent = this.formatYamlFrontmatter(finalFrontmatter) + '\n\n' + content;

          await writeMarkdown(noteFilename, fullContent, finalFrontmatter);

          return {
            success: true,
            filename: noteFilename,
            message: 'Note created successfully'
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Get tags tool
    this.registerTool(createTool(
      'get_tags',
      'Extract all tags from notes in the vault',
      createInputSchema({
        limit: {
          type: 'number',
          description: 'Maximum number of notes to scan',
          default: 50
        }
      }, []),
      async (args) => {
        const { limit = 50 } = args;

        serverLogger.info('Getting tags', { limit });

        try {
          const files = await getLogFiles();
          const tagSet = new Set();

          for (const file of files.slice(0, limit)) {
            try {
              const content = await readLogFile(file);

              // Extract tags from frontmatter
              const tagMatch = content.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
              if (tagMatch) {
                const tags = tagMatch[1].match(/-\s*(.+)/g);
                if (tags) {
                  tags.forEach(t => tagSet.add(t.replace(/-\s*/, '')));
                }
              }

              // Extract inline tags #tag
              const inlineTags = content.matchAll(/#(\w[\w-]*)/g);
              for (const match of inlineTags) {
                tagSet.add(match[1]);
              }
            } catch (e) {
              // Skip files that can't be read
            }
          }

          return {
            success: true,
            count: tagSet.size,
            tags: Array.from(tagSet).sort()
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    serverLogger.info('Obsidian Memory tools registered', {
      count: this.tools.size
    });
  }

  /**
   * Register resources for Obsidian
   */
  registerResources() {
    // Vault info resource
    this.registerResource({
      uri: 'obsidian://vault/info',
      name: 'Vault Information',
      description: 'Information about the Obsidian vault',
      mimeType: 'application/json',
      handler: async () => {
        return {
          vaultPath: this.vaultPath,
          logsFolder: this.logsFolder,
          serverVersion: '1.0.0'
        };
      }
    });

    // Notes list resource
    this.registerResource({
      uri: 'obsidian://vault/notes',
      name: 'All Notes',
      description: 'List of all notes in the vault',
      mimeType: 'application/json',
      handler: async () => {
        const files = await getLogFiles();
        return {
          count: files.length,
          notes: files
        };
      }
    });
  }

  /**
   * Parse YAML frontmatter
   */
  parseYamlFrontmatter(yamlText) {
    const frontmatter = {};
    const lines = yamlText.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        // Handle arrays
        if (value.trim() === '') {
          frontmatter[key] = [];
        } else if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = JSON.parse(value);
        } else {
          frontmatter[key] = value;
        }
      } else if (line.startsWith('  - ')) {
        // Array item
        const arrayKey = Object.keys(frontmatter).find(k => Array.isArray(frontmatter[k]));
        if (arrayKey) {
          frontmatter[arrayKey].push(line.substring(4));
        }
      }
    }

    return frontmatter;
  }

  /**
   * Format YAML frontmatter
   */
  formatYamlFrontmatter(obj) {
    let yaml = '---\n';

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        yaml += `${key}:\n`;
        for (const item of value) {
          yaml += `  - ${item}\n`;
        }
      } else if (typeof value === 'object') {
        yaml += `${key}:\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          yaml += `  ${subKey}: ${subValue}\n`;
        }
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }

    yaml += '---';
    return yaml;
  }

  /**
   * Generate filename from title
   */
  generateFilename(title) {
    const date = new Date().toISOString().split('T')[0];
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    return `${date}-${slug}.md`;
  }
}

/**
 * Create and start the Obsidian Memory server
 */
export async function createObsidianMemoryServer(config) {
  const server = new ObsidianMemoryServer(config);
  await server.initialize();
  return server;
}

export default {
  ObsidianMemoryServer,
  createObsidianMemoryServer
};
