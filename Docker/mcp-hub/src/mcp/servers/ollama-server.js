// ============================================================
// Ollama MCP Server
// ============================================================
// Task: US-010 - MCP Server for Ollama model access
// Description: Access Ollama models through MCP

import { BaseMCPServer, createTool, createInputSchema } from '../base-server.js';
import {
  routeRequest,
  chat,
  generateEmbedding,
  visionRequest,
  getAvailableModels,
  getModelInfo,
  pullModel,
  taskTypes
} from '../../services/ollama-router.js';
import { logger } from '../../utils/logger.js';
import { createModuleLogger } from '../../utils/log-helpers.js';

const serverLogger = createModuleLogger('OllamaServer');

/**
 * Ollama MCP Server
 * Provides tools for accessing Ollama LLM models
 */
export class OllamaServer extends BaseMCPServer {
  constructor(config = {}) {
    super({
      name: 'ollama',
      version: '1.0.0',
      description: 'MCP server for Ollama model operations',
      capabilities: {
        tools: {}
      }
    });

    this.config = config;
    this.currentModel = config.defaultModel || null;
    this.registerTools();
  }

  /**
   * Register all Ollama tools
   */
  registerTools() {
    // Chat tool
    this.registerTool(createTool(
      'chat',
      'Send a chat completion request to an Ollama model',
      createInputSchema({
        messages: {
          type: 'array',
          description: 'Array of chat messages',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' }
            },
            required: ['role', 'content']
          }
        },
        model: {
          type: 'string',
          description: 'Model name (optional, uses default if not specified)'
        },
        stream: {
          type: 'boolean',
          description: 'Whether to stream the response',
          default: false
        },
        taskType: {
          type: 'string',
          description: 'Task type for model routing',
          enum: Object.values(taskTypes),
          default: taskTypes.CHAT
        }
      }, ['messages']),
      async (args) => {
        const { messages, model, stream = false, taskType = taskTypes.CHAT } = args;

        serverLogger.info('Chat request', {
          messageCount: messages.length,
          model,
          taskType
        });

        try {
          const result = await chat(messages, model, { stream });

          return {
            success: true,
            model: result.model,
            message: result.message,
            done: result.done,
            duration_ms: result.duration_ms
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Complete tool
    this.registerTool(createTool(
      'complete',
      'Generate a completion from a prompt',
      createInputSchema({
        prompt: {
          type: 'string',
          description: 'Text prompt for completion'
        },
        model: {
          type: 'string',
          description: 'Model name (optional)'
        },
        taskType: {
          type: 'string',
          description: 'Task type for model routing',
          enum: Object.values(taskTypes),
          default: taskTypes.CHAT
        }
      }, ['prompt']),
      async (args) => {
        const { prompt, model, taskType = taskTypes.CHAT } = args;

        serverLogger.info('Completion request', {
          promptLength: prompt.length,
          model,
          taskType
        });

        try {
          const result = await routeRequest(taskType, prompt, { model });

          return {
            success: true,
            model: result.model,
            response: result.response,
            done: result.done,
            duration_ms: result.duration_ms,
            prompt_eval_count: result.prompt_eval_count,
            eval_count: result.eval_count
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Embed tool
    this.registerTool(createTool(
      'embed',
      'Generate embeddings for text',
      createInputSchema({
        text: {
          type: 'string',
          description: 'Text to embed'
        },
        model: {
          type: 'string',
          description: 'Embedding model name (optional)'
        }
      }, ['text']),
      async (args) => {
        const { text, model } = args;

        serverLogger.info('Embedding request', {
          textLength: text.length,
          model
        });

        try {
          const result = await generateEmbedding(text, model);

          return {
            success: true,
            model: result.model,
            embedding: result.embedding,
            dimension: result.embedding.length,
            duration_ms: result.duration_ms
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Vision tool
    this.registerTool(createTool(
      'vision',
      'Analyze an image with a vision model',
      createInputSchema({
        image: {
          type: 'string',
          description: 'Base64 encoded image data or image URL'
        },
        prompt: {
          type: 'string',
          description: 'Prompt for image analysis'
        },
        model: {
          type: 'string',
          description: 'Vision model name (optional)'
        }
      }, ['image', 'prompt']),
      async (args) => {
        const { image, prompt, model } = args;

        serverLogger.info('Vision request', {
          prompt,
          model,
          imageLength: image.length
        });

        try {
          const result = await visionRequest(image, prompt, model);

          return {
            success: true,
            model: result.model,
            response: result.response,
            done: result.done,
            duration_ms: result.duration_ms
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // List models tool
    this.registerTool(createTool(
      'list_models',
      'List all available Ollama models',
      createInputSchema({
        refresh: {
          type: 'boolean',
          description: 'Force refresh from Ollama API',
          default: false
        }
      }, []),
      async (args) => {
        const { refresh = false } = args;

        serverLogger.info('Listing models', { refresh });

        try {
          const models = await getAvailableModels(refresh);

          return {
            success: true,
            count: models.length,
            models: models.map(m => ({
              name: m.name,
              size: m.size,
              modified: m.modified_at,
              digest: m.digest
            }))
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Get model info tool
    this.registerTool(createTool(
      'get_model_info',
      'Get detailed information about a specific model',
      createInputSchema({
        model: {
          type: 'string',
          description: 'Model name'
        }
      }, ['model']),
      async (args) => {
        const { model } = args;

        serverLogger.info('Getting model info', { model });

        try {
          const info = await getModelInfo(model);

          if (!info.available) {
            return {
              success: false,
              error: info.error || 'Model not available'
            };
          }

          return {
            success: true,
            model: info.name,
            details: info.details
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Pull model tool
    this.registerTool(createTool(
      'pull_model',
      'Download a model from Ollama library',
      createInputSchema({
        model: {
          type: 'string',
          description: 'Model name to pull (e.g., llama3.2, mistral, codellama)'
        }
      }, ['model']),
      async (args) => {
        const { model } = args;

        serverLogger.info('Pulling model', { model });

        try {
          const result = await pullModel(model);

          return {
            success: true,
            model: result.model,
            status: result.status,
            message: `Model ${model} pulled successfully`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Set default model tool
    this.registerTool(createTool(
      'set_default_model',
      'Set the default model for future requests',
      createInputSchema({
        model: {
          type: 'string',
          description: 'Model name to use as default'
        },
        taskType: {
          type: 'string',
          description: 'Task type to set model for',
          enum: Object.values(taskTypes),
          default: taskTypes.CHAT
        }
      }, ['model']),
      async (args) => {
        const { model, taskType = taskTypes.CHAT } = args;

        serverLogger.info('Setting default model', { model, taskType });

        try {
          const { setModelForTask } = await import('../../services/ollama-router.js');
          setModelForTask(taskType, model);

          return {
            success: true,
            model,
            taskType,
            message: `Default model for ${taskType} set to ${model}`
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Reasoning tool (uses reasoning model)
    this.registerTool(createTool(
      'reasoning',
      'Perform reasoning task with specialized model',
      createInputSchema({
        prompt: {
          type: 'string',
          description: 'Reasoning prompt'
        },
        model: {
          type: 'string',
          description: 'Reasoning model name (optional)'
        }
      }, ['prompt']),
      async (args) => {
        const { prompt, model } = args;

        serverLogger.info('Reasoning request', {
          promptLength: prompt.length,
          model
        });

        try {
          const result = await routeRequest(taskTypes.REASONING, prompt, { model });

          return {
            success: true,
            model: result.model,
            reasoning: result.response,
            done: result.done,
            duration_ms: result.duration_ms
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    // Coding tool (uses coding model)
    this.registerTool(createTool(
      'coding',
      'Generate code with specialized model',
      createInputSchema({
        prompt: {
          type: 'string',
          description: 'Code generation prompt'
        },
        model: {
          type: 'string',
          description: 'Coding model name (optional)'
        },
        language: {
          type: 'string',
          description: 'Programming language hint'
        }
      }, ['prompt']),
      async (args) => {
        const { prompt, model, language } = args;

        serverLogger.info('Coding request', {
          promptLength: prompt.length,
          model,
          language
        });

        const enhancedPrompt = language
          ? `Write ${language} code for:\n${prompt}`
          : prompt;

        try {
          const result = await routeRequest(taskTypes.CODING, enhancedPrompt, { model });

          return {
            success: true,
            model: result.model,
            code: result.response,
            done: result.done,
            duration_ms: result.duration_ms
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
    ));

    serverLogger.info('Ollama tools registered', {
      count: this.tools.size
    });
  }
}

/**
 * Create and start the Ollama server
 */
export async function createOllamaServer(config) {
  const server = new OllamaServer(config);
  await server.initialize();
  return server;
}

export default {
  OllamaServer,
  createOllamaServer
};
