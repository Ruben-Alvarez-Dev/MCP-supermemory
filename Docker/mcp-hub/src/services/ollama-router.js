// ============================================================
// Ollama Model Router
// ============================================================
// Task: US-005 - Route requests to appropriate Ollama models
// Description: Model discovery, routing, and management for Ollama

import ollama from 'ollama';
import { logger } from '../utils/logger.js';
import { recordOllamaRequest } from '../routes/metrics.js';

/**
 * Model configuration
 */
const modelConfig = {
  host: process.env.OLLAMA_HOST || 'localhost',
  port: process.env.OLLAMA_PORT || 11434,
  defaultModels: {
    reasoning: process.env.OLLAMA_REASONING_MODEL || 'qwq:latest',
    coding: process.env.OLLAMA_CODING_MODEL || 'deepseek-coder:latest',
    vision: process.env.OLLAMA_VISION_MODEL || 'llava:latest',
    chat: process.env.OLLAMA_CHAT_MODEL || 'llama3.2:latest',
    embedding: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text:latest',
    fallback: process.env.OLLAMA_FALLBACK_MODEL || 'llama3.2:latest'
  },
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000'), // 2 minutes
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '3')
};

/**
 * Available models cache
 */
let availableModels = [];
let lastModelRefresh = null;
const MODEL_CACHE_TTL = 300000; // 5 minutes

/**
 * Task type definitions
 */
const taskTypes = {
  REASONING: 'reasoning',
  CODING: 'coding',
  VISION: 'vision',
  CHAT: 'chat',
  EMBEDDING: 'embedding',
  GENERAL: 'general'
};

/**
 * Initialize Ollama router
 */
export async function initializeOllama() {
  logger.info('Initializing Ollama router', {
    host: modelConfig.host,
    port: modelConfig.port
  });

  try {
    await refreshAvailableModels();
    logger.info('Ollama router initialized', {
      availableModels: availableModels.length
    });
  } catch (error) {
    logger.warn('Failed to refresh Ollama models, will retry later', {
      error: error.message
    });
  }
}

/**
 * Refresh available models from Ollama
 */
export async function refreshAvailableModels() {
  const startTime = Date.now();

  try {
    const response = await ollama.list({
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    availableModels = response.models.map(m => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
      digest: m.digest
    }));

    lastModelRefresh = new Date();

    logger.info('Ollama models refreshed', {
      count: availableModels.length,
      duration_ms: Date.now() - startTime
    });

    return availableModels;
  } catch (error) {
    logger.error('Failed to refresh Ollama models', {
      error: error.message,
      duration_ms: Date.now() - startTime
    });
    throw error;
  }
}

/**
 * Get available models
 */
export async function getAvailableModels(forceRefresh = false) {
  if (forceRefresh || !lastModelRefresh || Date.now() - lastModelRefresh > MODEL_CACHE_TTL) {
    await refreshAvailableModels();
  }

  return availableModels;
}

/**
 * Check if a model is available
 */
export async function isModelAvailable(modelName) {
  try {
    const models = await getAvailableModels();
    return models.some(m => m.name === modelName || m.name.startsWith(modelName));
  } catch (error) {
    logger.warn('Failed to check model availability', { error: error.message, modelName });
    return false;
  }
}

/**
 * Get model for task type
 */
export function getModelForTask(taskType) {
  const model = modelConfig.defaultModels[taskType] || modelConfig.defaultModels.fallback;
  logger.debug('Selected model for task', { taskType, model });
  return model;
}

/**
 * Set model for task type (user override)
 */
export function setModelForTask(taskType, modelName) {
  if (modelConfig.defaultModels[taskType]) {
    modelConfig.defaultModels[taskType] = modelName;
    logger.info('Model override set', { taskType, modelName });
  } else {
    logger.warn('Invalid task type for model override', { taskType });
  }
}

/**
 * Route request to appropriate model
 */
export async function routeRequest(taskType, prompt, options = {}) {
  const startTime = Date.now();
  let selectedModel = options.model || getModelForTask(taskType);

  try {
    // Check if selected model is available
    const isAvailable = await isModelAvailable(selectedModel);

    if (!isAvailable) {
      logger.warn('Selected model not available, using fallback', {
        selectedModel,
        fallbackModel: modelConfig.defaultModels.fallback
      });
      selectedModel = modelConfig.defaultModels.fallback;
    }

    logger.info('Routing Ollama request', {
      taskType,
      model: selectedModel,
      promptLength: prompt?.length || 0
    });

    // Execute the request
    const response = await executeWithRetry(selectedModel, prompt, options);

    const duration = Date.now() - startTime;

    // Record metrics
    recordOllamaRequest(selectedModel, 'success', duration / 1000);

    logger.info('Ollama request completed', {
      model: selectedModel,
      taskType,
      duration_ms: duration
    });

    return {
      model: selectedModel,
      response: response.response,
      done: response.done,
      duration_ms: duration,
      prompt_eval_count: response.prompt_eval_count,
      eval_count: response.eval_count
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Record metrics
    recordOllamaRequest(selectedModel, 'error', duration / 1000);

    logger.error('Ollama request failed', {
      model: selectedModel,
      taskType,
      error: error.message,
      duration_ms: duration
    });

    throw error;
  }
}

/**
 * Execute request with retry logic
 */
async function executeWithRetry(model, prompt, options, retryCount = 0) {
  const requestOptions = {
    model,
    prompt,
    host: `${modelConfig.host}:${modelConfig.port}`,
    stream: options.stream || false,
    ...options
  };

  try {
    if (options.images) {
      return await ollama.generate({
        ...requestOptions,
        images: options.images
      });
    } else if (options.chat) {
      return await ollama.chat({
        ...requestOptions,
        messages: options.messages || [{ role: 'user', content: prompt }]
      });
    } else {
      return await ollama.generate(requestOptions);
    }
  } catch (error) {
    if (retryCount < modelConfig.maxRetries && isRetryableError(error)) {
      logger.warn('Retrying Ollama request', {
        attempt: retryCount + 1,
        maxRetries: modelConfig.maxRetries,
        error: error.message
      });

      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      return executeWithRetry(model, prompt, options, retryCount + 1);
    }

    throw error;
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  const retryableMessages = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET',
    'timeout',
    'connection'
  ];

  return retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Generate embedding
 */
export async function generateEmbedding(text, model = null) {
  const startTime = Date.now();

  try {
    const selectedModel = model || modelConfig.defaultModels.embedding;

    const response = await ollama.embeddings({
      model: selectedModel,
      prompt: text,
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    const duration = Date.now() - startTime;

    logger.info('Embedding generated', {
      model: selectedModel,
      textLength: text.length,
      duration_ms: duration
    });

    return {
      embedding: response.embedding,
      model: selectedModel,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Embedding generation failed', {
      model,
      error: error.message,
      duration_ms: duration
    });
    throw error;
  }
}

/**
 * Chat completion
 */
export async function chat(messages, model = null, options = {}) {
  const startTime = Date.now();

  try {
    const selectedModel = model || getModelForTask(taskTypes.CHAT);

    const response = await ollama.chat({
      model: selectedModel,
      messages,
      host: `${modelConfig.host}:${modelConfig.port}`,
      stream: options.stream || false,
      ...options
    });

    const duration = Date.now() - startTime;

    logger.info('Chat completion completed', {
      model: selectedModel,
      messageCount: messages.length,
      duration_ms: duration
    });

    return {
      model: selectedModel,
      message: response.message,
      done: response.done,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Chat completion failed', {
      model,
      error: error.message,
      duration_ms: duration
    });
    throw error;
  }
}

/**
 * Vision request
 */
export async function visionRequest(image, prompt, model = null) {
  const startTime = Date.now();

  try {
    const selectedModel = model || getModelForTask(taskTypes.VISION);

    const response = await ollama.generate({
      model: selectedModel,
      prompt,
      images: [image],
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    const duration = Date.now() - startTime;

    logger.info('Vision request completed', {
      model: selectedModel,
      duration_ms: duration
    });

    return {
      model: selectedModel,
      response: response.response,
      done: response.done,
      duration_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Vision request failed', {
      model,
      error: error.message,
      duration_ms: duration
    });
    throw error;
  }
}

/**
 * Check Ollama health
 */
export async function checkHealth() {
  const startTime = Date.now();

  try {
    const response = await ollama.list({
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    const duration = Date.now() - startTime;

    return {
      status: 'healthy',
      message: 'Ollama service OK',
      host: modelConfig.host,
      port: modelConfig.port,
      modelCount: response.models.length,
      response_time_ms: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      status: 'unhealthy',
      message: error.message,
      host: modelConfig.host,
      port: modelConfig.port,
      response_time_ms: duration
    };
  }
}

/**
 * Get model info
 */
export async function getModelInfo(modelName) {
  try {
    const response = await ollama.show({
      model: modelName,
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    return {
      name: modelName,
      details: response,
      available: true
    };
  } catch (error) {
    return {
      name: modelName,
      error: error.message,
      available: false
    };
  }
}

/**
 * Pull a model
 */
export async function pullModel(modelName) {
  logger.info('Pulling Ollama model', { modelName });

  try {
    const response = await ollama.pull({
      model: modelName,
      host: `${modelConfig.host}:${modelConfig.port}`
    });

    logger.info('Model pulled successfully', { modelName });

    // Refresh model list
    await refreshAvailableModels();

    return {
      success: true,
      model: modelName,
      status: response.status
    };
  } catch (error) {
    logger.error('Failed to pull model', { modelName, error: error.message });
    throw error;
  }
}

export default {
  initializeOllama,
  refreshAvailableModels,
  getAvailableModels,
  isModelAvailable,
  getModelForTask,
  setModelForTask,
  routeRequest,
  generateEmbedding,
  chat,
  visionRequest,
  checkHealth,
  getModelInfo,
  pullModel,
  taskTypes,
  modelConfig
};
