// ============================================================
// MCP-SUPERSERVER - Ollama MCP Tools
// ============================================================

import axios from 'axios';
import { logger } from '../../utils/logger.js';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || '11434';
const OLLAMA_BASE_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}`;

// ============================================================
// Ollama Tools for MCP
// ============================================================

export const ollamaTools = {
  chat: {
    name: 'ollama_chat',
    description: 'Send a chat message to an Ollama model and get a response',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name (e.g., llama3.2, mistral, deepseek-r1)'
        },
        prompt: {
          type: 'string',
          description: 'User message/prompt'
        },
        system: {
          type: 'string',
          description: 'Optional system prompt'
        },
        temperature: {
          type: 'number',
          description: 'Temperature 0-1 (default: 0.7)',
          minimum: 0,
          maximum: 1
        },
        stream: {
          type: 'boolean',
          description: 'Stream response (default: false)',
          default: false
        }
      },
      required: ['model', 'prompt']
    }
  },

  complete: {
    name: 'ollama_complete',
    description: 'Text completion using Ollama',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name'
        },
        prompt: {
          type: 'string',
          description: 'Text to complete'
        },
        suffix: {
          type: 'string',
          description: 'Optional text to guide completion'
        },
        options: {
          type: 'object',
          description: 'Additional model options',
          additionalProperties: true
        }
      },
      required: ['model', 'prompt']
    }
  },

  embed: {
    name: 'ollama_embed',
    description: 'Generate embeddings for text using Ollama',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Embedding model name (e.g., nomic-embed-text)',
          default: 'nomic-embed-text'
        },
        text: {
          type: 'string',
          description: 'Text to embed'
        }
      },
      required: ['text']
    }
  },

  list_models: {
    name: 'ollama_list_models',
    description: 'List available Ollama models',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  pull_model: {
    name: 'ollama_pull_model',
    description: 'Pull/download a model from Ollama registry',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name to pull (e.g., llama3.2)'
        },
        insecure: {
          type: 'boolean',
          description: 'Allow insecure connections (default: false)',
          default: false
        }
      },
      required: ['model']
    }
  },

  show_model_info: {
    name: 'ollama_show_model_info',
    description: 'Get detailed information about a model',
    inputSchema: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'Model name'
        }
      },
      required: ['model']
    }
  }
};

// ============================================================
// Helper Functions
// ============================================================

async function ollamaRequest(endpoint, data = {}) {
  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/${endpoint}`,
      data,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000 // 2 minutes timeout
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Ollama API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      throw new Error(`Ollama not reachable at ${OLLAMA_BASE_URL}`);
    }
    throw error;
  }
}

async function ollamaGet(endpoint) {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/${endpoint}`, {
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Ollama API error: ${error.response.status}`);
    } else if (error.request) {
      throw new Error(`Ollama not reachable at ${OLLAMA_BASE_URL}`);
    }
    throw error;
  }
}

// ============================================================
// Tool Handlers
// ============================================================

const handlers = {
  async chat({ model, prompt, system, temperature = 0.7, stream = false }) {
    const data = {
      model,
      prompt,
      stream,
      options: {
        temperature
      }
    };

    if (system) {
      data.system = system;
    }

    logger.info('Ollama: Chat request', { model, promptLength: prompt.length });

    const result = await ollamaRequest('chat', data);

    if (result.message) {
      logger.info('Ollama: Chat response', {
        model,
        responseLength: result.message.content?.length || 0
      });

      return {
        success: true,
        model,
        response: result.message.content,
        done: result.done,
        context: result.context,
        prompt_eval_count: result.prompt_eval_count,
        eval_count: result.eval_count
      };
    }

    // Legacy API support
    if (result.response) {
      logger.info('Ollama: Generate response', {
        model,
        responseLength: result.response.length
      });

      return {
        success: true,
        model,
        response: result.response,
        done: result.done,
        context: result.context
      };
    }

    throw new Error('Unexpected response format from Ollama');
  },

  async complete({ model, prompt, suffix, options = {} }) {
    const data = {
      model,
      prompt,
      options
    };

    if (suffix) {
      data.suffix = suffix;
    }

    logger.info('Ollama: Completion request', { model, promptLength: prompt.length });

    const result = await ollamaRequest('generate', data);

    logger.info('Ollama: Completion response', {
      model,
      responseLength: result.response?.length || 0
    });

    return {
      success: true,
      model,
      completion: result.response,
      done: result.done,
      context: result.context
    };
  },

  async embed({ model = 'nomic-embed-text', text }) {
    const data = {
      model,
      input: text
    };

    logger.info('Ollama: Embedding request', {
      model,
      textLength: text.length
    });

    const result = await ollamaRequest('embed', data);

    if (result.embeddings && result.embeddings.length > 0) {
      logger.info('Ollama: Embedding generated', {
        model,
        dimension: result.embeddings[0].length
      });

      return {
        success: true,
        model,
        embedding: result.embeddings[0],
        dimension: result.embeddings[0].length
      };
    }

    throw new Error('No embedding returned from Ollama');
  },

  async list_models() {
    logger.info('Ollama: Listing models');

    const result = await ollamaGet('tags');

    const models = result.models || [];

    logger.info('Ollama: Models listed', { count: models.length });

    return {
      success: true,
      models: models.map(m => ({
        name: m.name,
        size: m.size,
        modified: m.modified_at,
        digest: m.digest,
        details: m.details
      })),
      count: models.length
    };
  },

  async pull_model({ model, insecure = false }) {
    logger.info('Ollama: Pulling model', { model });

    // For pull, we need to handle streaming
    try {
      const response = await axios.post(
        `${OLLAMA_BASE_URL}/api/pull`,
        {
          name: model,
          insecure,
          stream: true
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 600000, // 10 minutes for large models
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        const status = {
          success: true,
          model,
          status: 'pulling',
          digest: null,
          total: null,
          completed: null
        };

        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(Boolean);

          for (const line of lines) {
            try {
              const data = JSON.parse(line);

              if (data.status) {
                status.status = data.status;
              }

              if (data.digest) {
                status.digest = data.digest;
              }

              if (data.total) {
                status.total = data.total;
              }

              if (data.completed !== undefined) {
                status.completed = data.completed;
              }

              if (data.error) {
                reject(new Error(`Pull error: ${data.error}`));
                return;
              }

              logger.debug('Ollama: Pull progress', {
                model,
                status: data.status,
                completed: data.completed,
                total: data.total
              });
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        });

        response.data.on('end', () => {
          logger.info('Ollama: Model pulled', { model });
          status.status = 'success';
          resolve(status);
        });

        response.data.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Ollama: Pull failed', { model, error: error.message });
      throw error;
    }
  },

  async show_model_info({ model }) {
    logger.info('Ollama: Getting model info', { model });

    const result = await ollamaRequest('show', { name: model });

    logger.info('Ollama: Model info retrieved', { model });

    return {
      success: true,
      model,
      license: result.license,
      modelfile: result.modelfile,
      parameters: result.parameters,
      template: result.template,
      details: result.details
    };
  }
};

// Attach handlers to tool definitions
Object.keys(ollamaTools).forEach(key => {
  ollamaTools[key].handler = handlers[key];
});

export default handlers;
