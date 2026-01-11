// ============================================================
// Task Master MCP Server
// ============================================================
// Task: US-012 - MCP Server for task management
// Description: Manage complex tasks with subtasks

import { BaseMCPServer, createTool, createInputSchema } from '../base-server.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { createModuleLogger } from '../../utils/log-helpers.js';
import {
  createEntity,
  getEntityById,
  findEntities,
  updateEntity,
  deleteEntity
} from '../../services/neo4j-entities.js';
import {
  createRelationship,
  getEntityRelationships
} from '../../services/neo4j-relationships.js';

const serverLogger = createModuleLogger('TaskMasterServer');

/**
 * Task Master MCP Server
 * Provides tools for managing tasks and subtasks
 */
export class TaskMasterServer extends BaseMCPServer {
  constructor(config = {}) {
    super({
      name: 'task-master',
      version: '1.0.0',
      description: 'MCP server for task management',
      capabilities: {
        tools: {},
        resources: {}
      }
    });

    this.taskStore = config.taskStore || 'neo4j';
    this.registerTools();
  }

  /**
   * Register all task management tools
   */
  registerTools() {
    // Create task tool
    this.registerTool(createTool(
      'create_task',
      'Create a new task',
      createInputSchema({
        title: {
          type: 'string',
          description: 'Task title'
        },
        description: {
          type: 'string',
          description: 'Detailed task description'
        },
        priority: {
          type: 'string',
          description: 'Task priority',
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium'
        },
        status: {
          type: 'string',
          description: 'Initial task status',
          enum: ['pending', 'in_progress', 'blocked', 'deferred'],
          default: 'pending'
        },
        assignee: {
          type: 'string',
          description: 'Task assignee'
        },
        tags: {
          type: 'array',
          description: 'Task tags',
          items: { type: 'string' }
        },
        dueDate: {
          type: 'string',
          description: 'Due date (ISO 8601 format)'
        },
        parentTaskId: {
          type: 'string',
          description: 'Parent task ID if this is a subtask'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
          additionalProperties: true
        }
      }, ['title']),
      async (args) => {
        const {
          title,
          description,
          priority = 'medium',
          status = 'pending',
          assignee,
          tags = [],
          dueDate,
          parentTaskId,
          metadata = {}
        } = args;

        serverLogger.info('Creating task', {
          title,
          priority,
          parentTaskId
        });

        const taskId = uuidv4();
        const timestamp = new Date().toISOString();

        const taskData = {
          id: taskId,
          title,
          description,
          priority,
          status,
          assignee,
          tags,
          due_date: dueDate,
          created_at: timestamp,
          updated_at: timestamp,
          completed_at: null,
          ...metadata
        };

        // Create task entity
        await createEntity('Task', taskData);

        // Link to parent if subtask
        if (parentTaskId) {
          await createRelationship(
            'Task',
            parentTaskId,
            'HAS_SUBTASK',
            'Task',
            taskId
          );
        }

        serverLogger.info('Task created', { taskId, title });

        return {
          success: true,
          taskId,
          status: 'created',
          task: taskData
        };
      }
    ));

    // Get task tool
    this.registerTool(createTool(
      'get_task',
      'Get details of a task',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'Task ID'
        },
        includeSubtasks: {
          type: 'boolean',
          description: 'Include subtasks in response',
          default: true
        }
      }, ['taskId']),
      async (args) => {
        const { taskId, includeSubtasks = true } = args;

        serverLogger.info('Getting task', { taskId });

        const entity = await getEntityById('Task', taskId);

        if (!entity) {
          return {
            success: false,
            error: 'Task not found'
          };
        }

        const task = entity.properties;

        const response = {
          success: true,
          task
        };

        // Get subtasks if requested
        if (includeSubtasks) {
          const relationships = await getEntityRelationships('Task', taskId, 'outgoing', 'HAS_SUBTASK');
          response.subtasks = relationships.map(r => ({
            taskId: r.otherEntity.properties.id,
            title: r.otherEntity.properties.title,
            status: r.otherEntity.properties.status
          }));
          response.subtaskCount = response.subtasks.length;
        }

        return response;
      }
    ));

    // Update task tool
    this.registerTool(createTool(
      'update_task',
      'Update an existing task',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'Task ID'
        },
        title: {
          type: 'string',
          description: 'New task title'
        },
        description: {
          type: 'string',
          description: 'New task description'
        },
        status: {
          type: 'string',
          description: 'New task status',
          enum: ['pending', 'in_progress', 'completed', 'blocked', 'deferred', 'cancelled']
        },
        priority: {
          type: 'string',
          description: 'New task priority',
          enum: ['critical', 'high', 'medium', 'low']
        },
        assignee: {
          type: 'string',
          description: 'New assignee'
        },
        progress: {
          type: 'number',
          description: 'Progress percentage (0-100)',
          minimum: 0,
          maximum: 100
        }
      }, ['taskId']),
      async (args) => {
        const { taskId, ...updates } = args;

        serverLogger.info('Updating task', { taskId, updates });

        // Build update object
        const updateData = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) {
            updateData[key] = value;
          }
        }

        updateData.updated_at = new Date().toISOString();

        // Set completion timestamp if status is completed
        if (updateData.status === 'completed') {
          updateData.completed_at = updateData.updated_at;
          updateData.progress = 100;
        }

        const entity = await updateEntity('Task', taskId, updateData);

        if (!entity) {
          return {
            success: false,
            error: 'Task not found'
          };
        }

        serverLogger.info('Task updated', { taskId });

        return {
          success: true,
          taskId,
          task: entity.properties
        };
      }
    ));

    // Complete task tool
    this.registerTool(createTool(
      'complete_task',
      'Mark a task as completed',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'Task ID'
        },
        result: {
          type: 'string',
          description: 'Task result or completion notes'
        }
      }, ['taskId']),
      async (args) => {
        const { taskId, result } = args;

        serverLogger.info('Completing task', { taskId });

        const timestamp = new Date().toISOString();

        const entity = await updateEntity('Task', taskId, {
          status: 'completed',
          progress: 100,
          completed_at: timestamp,
          result,
          updated_at: timestamp
        });

        if (!entity) {
          return {
            success: false,
            error: 'Task not found'
          };
        }

        serverLogger.info('Task completed', { taskId });

        return {
          success: true,
          taskId,
          message: 'Task marked as completed'
        };
      }
    ));

    // Delete task tool
    this.registerTool(createTool(
      'delete_task',
      'Delete a task',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'Task ID'
        },
        deleteSubtasks: {
          type: 'boolean',
          description: 'Also delete subtasks',
          default: false
        }
      }, ['taskId']),
      async (args) => {
        const { taskId, deleteSubtasks = false } = args;

        serverLogger.info('Deleting task', { taskId, deleteSubtasks });

        // Get subtasks first if needed
        if (deleteSubtasks) {
          const relationships = await getEntityRelationships('Task', taskId, 'outgoing', 'HAS_SUBTASK');
          for (const rel of relationships) {
            const subtaskId = rel.otherEntity.properties.id;
            await deleteEntity('Task', subtaskId);
          }
        }

        const deleted = await deleteEntity('Task', taskId);

        if (!deleted) {
          return {
            success: false,
            error: 'Task not found'
          };
        }

        serverLogger.info('Task deleted', { taskId });

        return {
          success: true,
          message: 'Task deleted successfully'
        };
      }
    ));

    // List tasks tool
    this.registerTool(createTool(
      'list_tasks',
      'List tasks with optional filtering',
      createInputSchema({
        status: {
          type: 'string',
          description: 'Filter by status'
        },
        priority: {
          type: 'string',
          description: 'Filter by priority',
          enum: ['critical', 'high', 'medium', 'low']
        },
        assignee: {
          type: 'string',
          description: 'Filter by assignee'
        },
        tags: {
          type: 'array',
          description: 'Filter by tags (any match)',
          items: { type: 'string' }
        },
        parentTaskId: {
          type: 'string',
          description: 'Filter by parent task (get subtasks)'
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 100
        }
      }, []),
      async (args) => {
        const {
          status,
          priority,
          assignee,
          tags,
          parentTaskId,
          limit = 100
        } = args;

        serverLogger.info('Listing tasks', { status, priority, assignee });

        // Build filter properties
        const filters = {};
        if (status) filters.status = status;
        if (priority) filters.priority = priority;
        if (assignee) filters.assignee = assignee;

        let tasks = await findEntities('Task', filters, limit);

        // Additional filtering for tags and parent
        if (tags && tags.length > 0) {
          tasks = tasks.filter(t => {
            const taskTags = t.properties.tags || [];
            return tags.some(tag => taskTags.includes(tag));
          });
        }

        // Filter by parent
        if (parentTaskId) {
          const relationships = await getEntityRelationships('Task', parentTaskId, 'outgoing', 'HAS_SUBTASK');
          const subtaskIds = new Set(relationships.map(r => r.otherEntity.properties.id));
          tasks = tasks.filter(t => subtaskIds.has(t.properties.id));
        }

        return {
          success: true,
          count: tasks.length,
          tasks: tasks.map(t => ({
            id: t.properties.id,
            title: t.properties.title,
            status: t.properties.status,
            priority: t.properties.priority,
            progress: t.properties.progress || 0,
            assignee: t.properties.assignee,
            dueDate: t.properties.due_date,
            createdAt: t.properties.created_at
          }))
        };
      }
    ));

    // Add subtask tool
    this.registerTool(createTool(
      'add_subtask',
      'Add a subtask to an existing task',
      createInputSchema({
        parentTaskId: {
          type: 'string',
          description: 'Parent task ID'
        },
        title: {
          type: 'string',
          description: 'Subtask title'
        },
        description: {
          type: 'string',
          description: 'Subtask description'
        },
        priority: {
          type: 'string',
          description: 'Subtask priority',
          enum: ['critical', 'high', 'medium', 'low'],
          default: 'medium'
        }
      }, ['parentTaskId', 'title']),
      async (args) => {
        const { parentTaskId, title, description, priority = 'medium' } = args;

        serverLogger.info('Adding subtask', { parentTaskId, title });

        // Verify parent exists
        const parent = await getEntityById('Task', parentTaskId);
        if (!parent) {
          return {
            success: false,
            error: 'Parent task not found'
          };
        }

        // Create subtask using create_task logic
        const subtaskId = uuidv4();
        const timestamp = new Date().toISOString();

        const subtaskData = {
          id: subtaskId,
          title,
          description,
          priority,
          status: 'pending',
          created_at: timestamp,
          updated_at: timestamp
        };

        await createEntity('Task', subtaskData);
        await createRelationship('Task', parentTaskId, 'HAS_SUBTASK', 'Task', subtaskId);

        serverLogger.info('Subtask added', { subtaskId, parentTaskId });

        return {
          success: true,
          subtaskId,
          parentTaskId,
          message: 'Subtask added successfully'
        };
      }
    ));

    // Set task dependency tool
    this.registerTool(createTool(
      'set_dependency',
      'Set a dependency between tasks (task2 depends on task1)',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'The task that has the dependency'
        },
        dependsOnTaskId: {
          type: 'string',
          description: 'The task this depends on'
        },
        dependencyType: {
          type: 'string',
          description: 'Type of dependency',
          enum: ['must_complete_before', 'should_complete_before', 'blocks'],
          default: 'must_complete_before'
        }
      }, ['taskId', 'dependsOnTaskId']),
      async (args) => {
        const { taskId, dependsOnTaskId, dependencyType = 'must_complete_before' } = args;

        serverLogger.info('Setting dependency', {
          taskId,
          dependsOnTaskId,
          dependencyType
        });

        // Verify both tasks exist
        const task1 = await getEntityById('Task', taskId);
        const task2 = await getEntityById('Task', dependsOnTaskId);

        if (!task1 || !task2) {
          return {
            success: false,
            error: 'One or both tasks not found'
          };
        }

        await createRelationship(
          'Task',
          dependsOnTaskId,
          dependencyType.toUpperCase(),
          'Task',
          taskId
        );

        return {
          success: true,
          message: 'Dependency set successfully'
        };
      }
    ));

    // Get task dependencies tool
    this.registerTool(createTool(
      'get_dependencies',
      'Get dependencies for a task',
      createInputSchema({
        taskId: {
          type: 'string',
          description: 'Task ID'
        },
        direction: {
          type: 'string',
          description: 'Dependency direction',
          enum: ['incoming', 'outgoing', 'both'],
          default: 'both'
        }
      }, ['taskId']),
      async (args) => {
        const { taskId, direction = 'both' } = args;

        serverLogger.info('Getting dependencies', { taskId, direction });

        const relationships = await getEntityRelationships('Task', taskId, direction, null);

        const dependencies = relationships.map(r => ({
          taskId: r.otherEntity.properties.id,
          title: r.otherEntity.properties.title,
          status: r.otherEntity.properties.status,
          relationshipType: r.relationship.type
        }));

        return {
          success: true,
          count: dependencies.length,
          dependencies
        };
      }
    ));

    serverLogger.info('Task Master tools registered', {
      count: this.tools.size
    });
  }
}

/**
 * Create and start the Task Master server
 */
export async function createTaskMasterServer(config) {
  const server = new TaskMasterServer(config);
  await server.initialize();
  return server;
}

export default {
  TaskMasterServer,
  createTaskMasterServer
};
