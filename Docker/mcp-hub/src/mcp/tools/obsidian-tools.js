// ============================================================
// MCP-SUPERSERVER - Obsidian MCP Tools
// ============================================================

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';

const VAULT_PATH = process.env.OBSIDIAN_VAULT || '/vault';

// ============================================================
// Obsidian Tools for MCP
// ============================================================

export const obsidianTools = {
  read_note: {
    name: 'read_note',
    description: 'Read a markdown note from Obsidian vault',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Note filename (with or without .md extension)'
        },
        parse_frontmatter: {
          type: 'boolean',
          description: 'Parse YAML frontmatter (default: true)',
          default: true
        }
      },
      required: ['filename']
    }
  },

  write_note: {
    name: 'write_note',
    description: 'Write or overwrite a markdown note in Obsidian vault',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Note filename (with or without .md extension)'
        },
        content: {
          type: 'string',
          description: 'Note content in markdown format'
        },
        frontmatter: {
          type: 'object',
          description: 'YAML frontmatter to add at the top',
          additionalProperties: true
        },
        create_dirs: {
          type: 'boolean',
          description: 'Create directories if needed (default: true)',
          default: true
        }
      },
      required: ['filename', 'content']
    }
  },

  append_note: {
    name: 'append_note',
    description: 'Append content to an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Note filename'
        },
        content: {
          type: 'string',
          description: 'Content to append'
        },
        separator: {
          type: 'string',
          description: 'Separator between existing and new content (default: \\n\\n)',
          default: '\n\n'
        }
      },
      required: ['filename', 'content']
    }
  },

  list_notes: {
    name: 'list_notes',
    description: 'List notes in the vault with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory to list (default: root)'
        },
        tag: {
          type: 'string',
          description: 'Filter by tag in frontmatter'
        },
        recursive: {
          type: 'boolean',
          description: 'List recursively (default: true)',
          default: true
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 100)',
          default: 100
        }
      }
    }
  },

  search_notes: {
    name: 'search_notes',
    description: 'Search for notes containing text or patterns',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text to search for'
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Case sensitive search (default: false)',
          default: false
        },
        include_content: {
          type: 'boolean',
          description: 'Include matching content snippets (default: false)',
          default: false
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
          default: 50
        }
      },
      required: ['query']
    }
  },

  create_note: {
    name: 'create_note',
    description: 'Create a new note with timestamp and optional template',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Note filename'
        },
        title: {
          type: 'string',
          description: 'Note title (used in heading and frontmatter)'
        },
        content: {
          type: 'string',
          description: 'Note content'
        },
        tags: {
          type: 'array',
          description: 'Tags to add',
          items: { type: 'string' }
        },
        template: {
          type: 'string',
          description: 'Template name (default, journal, etc.)',
          enum: ['default', 'journal', 'meeting', 'log'],
          default: 'default'
        }
      },
      required: ['filename', 'content']
    }
  },

  delete_note: {
    name: 'delete_note',
    description: 'Delete a note from the vault',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Note filename'
        }
      },
      required: ['filename']
    }
  }
};

// ============================================================
// Helper Functions
// ============================================================

function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  try {
    // Simple YAML parser for basic structures
    const frontmatter = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        // Handle arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        }
        // Handle booleans
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        // Remove quotes from strings
        else if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, body: match[2].trim() };
  } catch (error) {
    logger.warn('Failed to parse frontmatter', { error: error.message });
    return { frontmatter: null, body: content };
  }
}

function buildFrontmatter(frontmatter) {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return '';
  }

  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: "${value}"`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function normalizeFilename(filename) {
  if (!filename.endsWith('.md')) {
    return filename + '.md';
  }
  return filename;
}

function getFilePath(filename) {
  const normalized = normalizeFilename(filename);
  // Remove leading slash if present
  const cleanName = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  return path.join(VAULT_PATH, cleanName);
}

async function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// ============================================================
// Tool Handlers
// ============================================================

const handlers = {
  async read_note({ filename, parse_frontmatter = true }) {
    const filePath = getFilePath(filename);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      let result = {
        success: true,
        filename,
        path: filePath
      };

      if (parse_frontmatter) {
        const { frontmatter, body } = parseFrontmatter(content);
        result.frontmatter = frontmatter;
        result.content = body;
      } else {
        result.content = content;
      }

      logger.info('Obsidian: Note read', { filename });

      return result;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Note not found: ${filename}`);
      }
      throw error;
    }
  },

  async write_note({ filename, content, frontmatter, create_dirs = true }) {
    const filePath = getFilePath(filename);

    if (create_dirs) {
      await ensureDir(filePath);
    }

    let fullContent = content;
    if (frontmatter) {
      const fm = buildFrontmatter(frontmatter);
      fullContent = fm + '\n' + content;
    }

    await fs.writeFile(filePath, fullContent, 'utf-8');

    logger.info('Obsidian: Note written', { filename, path: filePath });

    return {
      success: true,
      filename,
      path: filePath,
      size: Buffer.byteLength(fullContent)
    };
  },

  async append_note({ filename, content, separator = '\n\n' }) {
    const filePath = getFilePath(filename);

    try {
      const existing = await fs.readFile(filePath, 'utf-8');
      const newContent = existing + separator + content;
      await fs.writeFile(filePath, newContent, 'utf-8');

      logger.info('Obsidian: Content appended', { filename });

      return {
        success: true,
        filename,
        previousSize: Buffer.byteLength(existing),
        newSize: Buffer.byteLength(newContent)
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Note not found: ${filename}. Use write_note to create new notes.`);
      }
      throw error;
    }
  },

  async list_notes({ directory = '', tag, recursive = true, limit = 100 }) {
    const searchPath = directory ? path.join(VAULT_PATH, directory) : VAULT_PATH;

    async function walkDir(dir, depth = 0) {
      const results = [];

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && recursive) {
            const subResults = await walkDir(path.join(dir, entry.name), depth + 1);
            results.push(...subResults);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const filePath = path.join(dir, entry.name);
            const relativePath = path.relative(VAULT_PATH, filePath);

            // Check tag if specified
            if (tag) {
              try {
                const content = await fs.readFile(filePath, 'utf-8');
                const { frontmatter } = parseFrontmatter(content);
                const tags = frontmatter?.tags || [];

                const tagArray = Array.isArray(tags) ? tags : [tags];
                if (!tagArray.includes(tag)) {
                  continue;
                }
              } catch {
                // Skip files that can't be read
                continue;
              }
            }

            results.push({
              filename: entry.name,
              path: relativePath,
              directory: path.dirname(relativePath)
            });

            if (results.length >= limit) {
              break;
            }
          }
        }
      } catch (error) {
        logger.warn('Error reading directory', { dir, error: error.message });
      }

      return results;
    }

    const notes = await walkDir(searchPath);

    logger.info('Obsidian: Notes listed', {
      count: notes.length,
      directory,
      tag
    });

    return {
      success: true,
      notes: notes.slice(0, limit),
      count: notes.length
    };
  },

  async search_notes({ query, case_sensitive = false, include_content = false, limit = 50 }) {
    const searchRegex = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      case_sensitive ? 'g' : 'gi'
    );

    async function searchInDir(dir) {
      const results = [];

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subResults = await searchInDir(path.join(dir, entry.name));
            results.push(...subResults);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            const filePath = path.join(dir, entry.name);
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              const matches = content.match(searchRegex);

              if (matches) {
                const result = {
                  filename: entry.name,
                  path: path.relative(VAULT_PATH, filePath),
                  matchCount: matches.length
                };

                if (include_content) {
                  // Get context around matches
                  const lines = content.split('\n');
                  const matchingLines = lines
                    .map((line, index) => ({ line, index }))
                    .filter(({ line }) => searchRegex.test(line))
                    .slice(0, 5); // Max 5 snippets

                  result.snippets = matchingLines.map(({ line, index }) => ({
                    lineNumber: index + 1,
                    text: line.trim().substring(0, 200)
                  }));
                }

                results.push(result);
              }
            } catch {
              // Skip files that can't be read
            }
          }

          if (results.length >= limit) {
            break;
          }
        }
      } catch (error) {
        logger.warn('Error searching directory', { dir, error: error.message });
      }

      return results;
    }

    const results = await searchInDir(VAULT_PATH);

    logger.info('Obsidian: Search completed', {
      query,
      count: results.length
    });

    return {
      success: true,
      query,
      results: results.slice(0, limit),
      count: results.length
    };
  },

  async create_note({ filename, title, content, tags = [], template = 'default' }) {
    const now = new Date();
    const timestamp = now.toISOString();

    let fullContent = content;
    let frontmatter = {
      created: timestamp,
      tags
    };

    if (title) {
      frontmatter.title = title;
    }

    // Apply template
    switch (template) {
      case 'journal':
        frontmatter.type = 'journal';
        fullContent = `# ${title || now.toLocaleDateString()}\n\n${content}`;
        break;

      case 'meeting':
        frontmatter.type = 'meeting';
        fullContent = `# ${title || 'Meeting'}\n\n**Date:** ${now.toLocaleString()}\n\n${content}`;
        break;

      case 'log':
        frontmatter.type = 'log';
        fullContent = `# ${title || 'Log Entry'}\n\n**Timestamp:** ${timestamp}\n\n${content}`;
        break;

      default:
        if (title) {
          fullContent = `# ${title}\n\n${content}`;
        }
    }

    return handlers.write_note({
      filename,
      content: fullContent,
      frontmatter,
      create_dirs: true
    });
  },

  async delete_note({ filename }) {
    const filePath = getFilePath(filename);

    try {
      await fs.unlink(filePath);

      logger.info('Obsidian: Note deleted', { filename });

      return {
        success: true,
        filename,
        deleted: true
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          success: true,
          filename,
          deleted: false,
          message: 'File does not exist'
        };
      }
      throw error;
    }
  }
};

// Attach handlers to tool definitions
Object.keys(obsidianTools).forEach(key => {
  obsidianTools[key].handler = handlers[key];
});

export default handlers;
