// ============================================================
// Sequential Thinking MCP Server
// ============================================================
// Task: US-011 - MCP Server for reasoning chains
// Description: Step-by-step reasoning with visibility

import { BaseMCPServer, createTool, createInputSchema } from '../base-server.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { createModuleLogger } from '../../utils/log-helpers.js';
import {
  createEntity,
  getEntityById,
  updateEntity,
  findEntities
} from '../../services/neo4j-entities.js';
import {
  createRelationship
} from '../../services/neo4j-relationships.js';
import {
  writeReasoningTrace,
  writeMarkdown
} from '../../services/obsidian-writer.js';

const serverLogger = createModuleLogger('SequentialThinkingServer');

/**
 * Sequential Thinking MCP Server
 * Provides tools for managing reasoning chains
 */
export class SequentialThinkingServer extends BaseMCPServer {
  constructor(config = {}) {
    super({
      name: 'sequential-thinking',
      version: '1.0.0',
      description: 'MCP server for step-by-step reasoning chains',
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.activeChains = new Map();
    this.chainStore = config.chainStore || 'neo4j'; // neo4j or memory
    this.exportToObsidian = config.exportToObsidian !== false;

    this.registerTools();
  }

  /**
   * Register all sequential thinking tools
   */
  registerTools() {
    // Start thinking tool
    this.registerTool(createTool(
      'start_thinking',
      'Start a new reasoning chain',
      createInputSchema({
        prompt: {
          type: 'string',
          description: 'The initial prompt or problem to reason about'
        },
        context: {
          type: 'object',
          description: 'Additional context for the reasoning',
          additionalProperties: true
        },
        goal: {
          type: 'string',
          description: 'The goal or expected outcome'
        },
        tags: {
          type: 'array',
          description: 'Tags for categorizing the chain',
          items: { type: 'string' }
        },
        branchFrom: {
          type: 'string',
          description: 'Chain ID to branch from (optional)'
        }
      }, ['prompt']),
      async (args) => {
        const { prompt, context = {}, goal, tags = [], branchFrom } = args;

        serverLogger.info('Starting reasoning chain', {
          promptLength: prompt.length,
          branchFrom
        });

        const chainId = uuidv4();
        const timestamp = new Date().toISOString();

        const chain = {
          id: chainId,
          prompt,
          context,
          goal,
          tags,
          steps: [],
          status: 'in_progress',
          created_at: timestamp,
          updated_at: timestamp,
          branch_from: branchFrom
        };

        // Store in memory
        this.activeChains.set(chainId, chain);

        // Store in Neo4j if enabled
        if (this.chainStore === 'neo4j') {
          try {
            await createEntity('ReasoningChain', {
              id: chainId,
              prompt,
              goal,
              status: 'in_progress',
              created_at: timestamp
            });

            // If branching, create relationship
            if (branchFrom) {
              await createRelationship(
                'ReasoningChain',
                branchFrom,
                'BRANCHED_TO',
                'ReasoningChain',
                chainId
              );
            }
          } catch (error) {
            serverLogger.warn('Failed to store chain in Neo4j', {
              error: error.message
            });
          }
        }

        // Log to Obsidian
        if (this.exportToObsidian) {
          writeReasoningTrace('sequential-thinking', prompt, {
            action: 'start',
            chainId,
            context
          }, null).catch(err => {
            serverLogger.warn('Failed to log to Obsidian', { error: err.message });
          });
        }

        return {
          success: true,
          chainId,
          status: 'started',
          message: 'Reasoning chain started',
          chain
        };
      }
    ));

    // Add step tool
    this.registerTool(createTool(
      'add_step',
      'Add a reasoning step to an existing chain',
      createInputSchema({
        chainId: {
          type: 'string',
          description: 'The chain ID'
        },
        thought: {
          type: 'string',
          description: 'The thought or reasoning for this step'
        },
        data: {
          type: 'object',
          description: 'Additional data for this step',
          additionalProperties: true
        },
        stepType: {
          type: 'string',
          description: 'Type of reasoning step',
          enum: ['observation', 'analysis', 'inference', 'conclusion', 'question', 'hypothesis'],
          default: 'analysis'
        },
        confidence: {
          type: 'number',
          description: 'Confidence level (0-1)',
          minimum: 0,
          maximum: 1
        }
      }, ['chainId', 'thought']),
      async (args) => {
        const { chainId, thought, data = {}, stepType = 'analysis', confidence } = args;

        serverLogger.info('Adding reasoning step', { chainId, stepType });

        const chain = this.activeChains.get(chainId);

        if (!chain) {
          return {
            success: false,
            error: 'Chain not found'
          };
        }

        const stepId = uuidv4();
        const timestamp = new Date().toISOString();

        const step = {
          id: stepId,
          step_number: chain.steps.length + 1,
          thought,
          data,
          step_type: stepType,
          confidence,
          created_at: timestamp
        };

        chain.steps.push(step);
        chain.updated_at = timestamp;

        // Update in Neo4j
        if (this.chainStore === 'neo4j') {
          try {
            // Create step entity
            await createEntity('ReasoningStep', {
              id: stepId,
              step_number: step.step_number,
              thought,
              step_type: stepType,
              confidence,
              created_at: timestamp
            });

            // Link to chain
            await createRelationship(
              'ReasoningChain',
              chainId,
              'HAS_STEP',
              'ReasoningStep',
              stepId,
              { order: step.step_number }
            );
          } catch (error) {
            serverLogger.warn('Failed to store step in Neo4j', {
              error: error.message
            });
          }
        }

        // Log to Obsidian
        if (this.exportToObsidian) {
          writeReasoningTrace('sequential-thinking', thought, {
            action: 'add_step',
            chainId,
            stepId,
            stepType,
            data
          }, null).catch(err => {
            serverLogger.warn('Failed to log to Obsidian', { error: err.message });
          });
        }

        return {
          success: true,
          stepId,
          stepNumber: step.step_number,
          message: 'Step added successfully'
        };
      }
    ));

    // Get chain tool
    this.registerTool(createTool(
      'get_chain',
      'Get details of a reasoning chain',
      createInputSchema({
        chainId: {
          type: 'string',
          description: 'The chain ID'
        },
        includeSteps: {
          type: 'boolean',
          description: 'Whether to include steps in response',
          default: true
        }
      }, ['chainId']),
      async (args) => {
        const { chainId, includeSteps = true } = args;

        serverLogger.info('Getting chain', { chainId });

        let chain = this.activeChains.get(chainId);

        // Try Neo4j if not in memory
        if (!chain && this.chainStore === 'neo4j') {
          try {
            const entity = await getEntityById('ReasoningChain', chainId);
            if (entity) {
              chain = {
                id: entity.properties.id,
                prompt: entity.properties.prompt,
                goal: entity.properties.goal,
                status: entity.properties.status,
                created_at: entity.properties.created_at,
                steps: [] // Steps would need to be fetched separately
              };
            }
          } catch (error) {
            serverLogger.warn('Failed to fetch chain from Neo4j', {
              error: error.message
            });
          }
        }

        if (!chain) {
          return {
            success: false,
            error: 'Chain not found'
          };
        }

        const response = {
          success: true,
          chainId,
          prompt: chain.prompt,
          goal: chain.goal,
          status: chain.status,
          created_at: chain.created_at,
          updated_at: chain.updated_at,
          stepCount: chain.steps.length
        };

        if (includeSteps) {
          response.steps = chain.steps;
        }

        return response;
      }
    ));

    // Conclude tool
    this.registerTool(createTool(
      'conclude',
      'Conclude a reasoning chain with a final result',
      createInputSchema({
        chainId: {
          type: 'string',
          description: 'The chain ID'
        },
        conclusion: {
          type: 'string',
          description: 'The final conclusion or result'
        },
        success: {
          type: 'boolean',
          description: 'Whether the reasoning was successful'
        },
        confidence: {
          type: 'number',
          description: 'Overall confidence in the conclusion',
          minimum: 0,
          maximum: 1
        },
      }, ['chainId', 'conclusion']),
      async (args) => {
        const { chainId, conclusion, success = true, confidence } = args;

        serverLogger.info('Concluding chain', { chainId, success });

        const chain = this.activeChains.get(chainId);

        if (!chain) {
          return {
            success: false,
            error: 'Chain not found'
          };
        }

        const timestamp = new Date().toISOString();

        chain.status = success ? 'completed' : 'failed';
        chain.conclusion = conclusion;
        chain.confidence = confidence;
        chain.completed_at = timestamp;
        chain.updated_at = timestamp;

        // Update in Neo4j
        if (this.chainStore === 'neo4j') {
          try {
            await updateEntity('ReasoningChain', chainId, {
              status: chain.status,
              conclusion,
              confidence,
              completed_at: timestamp
            });
          } catch (error) {
            serverLogger.warn('Failed to update chain in Neo4j', {
              error: error.message
            });
          }
        }

        // Log to Obsidian
        if (this.exportToObsidian) {
          writeReasoningTrace('sequential-thinking', conclusion, {
            action: 'conclude',
            chainId,
            success,
            confidence
          }, null).catch(err => {
            serverLogger.warn('Failed to log to Obsidian', { error: err.message });
          });

          // Export full chain to Obsidian
          this.exportChainToObsidian(chain).catch(err => {
            serverLogger.warn('Failed to export chain to Obsidian', {
              error: err.message
            });
          });
        }

        return {
          success: true,
          chainId,
          status: chain.status,
          conclusion,
          message: 'Chain concluded successfully'
        };
      }
    ));

    // List chains tool
    this.registerTool(createTool(
      'list_chains',
      'List all reasoning chains',
      createInputSchema({
        status: {
          type: 'string',
          description: 'Filter by status',
          enum: ['in_progress', 'completed', 'failed', 'all'],
          default: 'all'
        },
        limit: {
          type: 'number',
          description: 'Maximum chains to return',
          default: 50
        }
      }, []),
      async (args) => {
        const { status = 'all', limit = 50 } = args;

        serverLogger.info('Listing chains', { status, limit });

        let chains = Array.from(this.activeChains.values());

        if (status !== 'all') {
          chains = chains.filter(c => c.status === status);
        }

        chains = chains.slice(0, limit);

        return {
          success: true,
          count: chains.length,
          chains: chains.map(c => ({
            id: c.id,
            prompt: c.prompt.substring(0, 100) + '...',
            goal: c.goal,
            status: c.status,
            stepCount: c.steps.length,
            created_at: c.created_at
          }))
        };
      }
    ));

    // Branch chain tool
    this.registerTool(createTool(
      'branch_chain',
      'Create a branch from an existing reasoning chain',
      createInputSchema({
        chainId: {
          type: 'string',
          description: 'The chain ID to branch from'
        },
        atStep: {
          type: 'number',
          description: 'Step number to branch from (optional)'
        }
      }, ['chainId']),
      async (args) => {
        const { chainId, atStep } = args;

        serverLogger.info('Branching chain', { chainId, atStep });

        const chain = this.activeChains.get(chainId);

        if (!chain) {
          return {
            success: false,
            error: 'Chain not found'
          };
        }

        // Create new chain as branch
        const newChainId = uuidv4();
        const timestamp = new Date().toISOString();

        const stepsToCopy = atStep
          ? chain.steps.filter(s => s.step_number <= atStep)
          : chain.steps;

        const newChain = {
          id: newChainId,
          prompt: chain.prompt,
          context: { ...chain.context },
          goal: chain.goal,
          tags: [...chain.tags, 'branch'],
          steps: stepsToCopy.map(s => ({ ...s })),
          status: 'in_progress',
          created_at: timestamp,
          updated_at: timestamp,
          branch_from: chainId
        };

        this.activeChains.set(newChainId, newChain);

        // Store in Neo4j
        if (this.chainStore === 'neo4j') {
          try {
            await createEntity('ReasoningChain', {
              id: newChainId,
              prompt: chain.prompt,
              goal: chain.goal,
              status: 'in_progress',
              created_at: timestamp
            });

            await createRelationship(
              'ReasoningChain',
              chainId,
              'BRANCHED_TO',
              'ReasoningChain',
              newChainId
            );
          } catch (error) {
            serverLogger.warn('Failed to store branch in Neo4j', {
              error: error.message
            });
          }
        }

        return {
          success: true,
          chainId: newChainId,
          parentChainId: chainId,
          stepsCopied: stepsToCopy.length,
          message: 'Chain branched successfully'
        };
      }
    ));

    serverLogger.info('Sequential Thinking tools registered', {
      count: this.tools.size
    });
  }

  /**
   * Export chain to Obsidian markdown
   */
  async exportChainToObsidian(chain) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `reasoning-${date}-${chain.id.substring(0, 8)}.md`;

    let markdown = `# Reasoning Chain\n\n`;

    // Frontmatter
    markdown += `---\n`;
    markdown += `title: ${chain.prompt.substring(0, 50)}...\n`;
    markdown += `chain_id: ${chain.id}\n`;
    markdown += `status: ${chain.status}\n`;
    markdown += `created: ${chain.created_at}\n`;
    if (chain.goal) markdown += `goal: ${chain.goal}\n`;
    if (chain.tags && chain.tags.length > 0) {
      markdown += `tags:\n`;
      for (const tag of chain.tags) {
        markdown += `  - ${tag}\n`;
      }
    }
    markdown += `---\n\n`;

    // Prompt
    markdown += `## Prompt\n\n${chain.prompt}\n\n`;

    // Steps
    markdown += `## Reasoning Steps\n\n`;
    for (const step of chain.steps) {
      markdown += `### Step ${step.step_number}: ${step.step_type}\n\n`;
      markdown += `${step.thought}\n\n`;

      if (step.data && Object.keys(step.data).length > 0) {
        markdown += `**Data:**\n\`\`\`json\n${JSON.stringify(step.data, null, 2)}\n\`\`\`\n\n`;
      }

      if (step.confidence !== undefined) {
        markdown += `*Confidence: ${step.confidence}*\n\n`;
      }
    }

    // Conclusion
    if (chain.conclusion) {
      markdown += `## Conclusion\n\n${chain.conclusion}\n\n`;
      if (chain.confidence !== undefined) {
        markdown += `*Overall confidence: ${chain.confidence}*\n\n`;
      }
    }

    await writeMarkdown(filename, markdown, {
      chain_id: chain.id,
      status: chain.status
    });

    serverLogger.info('Chain exported to Obsidian', {
      chainId: chain.id,
      filename
    });
  }
}

/**
 * Create and start the Sequential Thinking server
 */
export async function createSequentialThinkingServer(config) {
  const server = new SequentialThinkingServer(config);
  await server.initialize();
  return server;
}

export default {
  SequentialThinkingServer,
  createSequentialThinkingServer
};
