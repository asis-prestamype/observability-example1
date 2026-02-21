import Router from 'koa-router';
import { Context } from 'koa';
import { ObjectId } from 'mongodb';
import { taskService } from '../services/taskService';
import { userService } from '../services/userService';
import { trace } from '@opentelemetry/api';
import logger from '../config/logger';

const router = new Router({ prefix: '/api/tasks' });
const tracer = trace.getTracer('task-routes');

// Create a new task
router.post('/', async (ctx: Context) => {
  await tracer.startActiveSpan('POST /api/tasks', async (span) => {
    try {
      const { title, description, userId, status = 'pending' } = ctx.request.body as {
        title: string;
        description: string;
        userId: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      };

      if (!title || !description || !userId) {
        ctx.status = 400;
        ctx.body = {
          error: 'Title, description, and userId are required',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      // Verify user exists
      const user = await userService.getUserById(userId);
      if (!user) {
        ctx.status = 400;
        ctx.body = {
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      const task = await taskService.createTask({
        title,
        description,
        status,
        userId: new ObjectId(userId),
      });

      span.setAttributes({
        'task.created.id': task._id.toString(),
        'task.created.title': task.title,
        'task.created.user_id': userId,
        'task.created.status': status,
      });

      ctx.status = 201;
      ctx.body = {
        message: 'Task created successfully',
        data: task,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error creating task', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Get all tasks
router.get('/', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/tasks', async (span) => {
    try {
      const limit = parseInt(ctx.query.limit as string) || 50;
      const offset = parseInt(ctx.query.offset as string) || 0;
      const status = ctx.query.status as string | undefined;

      const tasks = await taskService.getAllTasks(limit, offset, status);

      span.setAttributes({
        'query.limit': limit,
        'query.offset': offset,
        'query.status': status || 'all',
        'result.count': tasks.length,
      });

      ctx.body = {
        message: 'Tasks retrieved successfully',
        data: tasks,
        meta: {
          count: tasks.length,
          limit,
          offset,
          statusFilter: status,
        },
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting tasks', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Get task by ID
router.get('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/tasks/:id', async (span) => {
    try {
      const { id } = ctx.params;

      span.setAttributes({
        'task.id': id,
      });

      const task = await taskService.getTaskById(id);

      if (!task) {
        ctx.status = 404;
        ctx.body = {
          error: 'Task not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'Task retrieved successfully',
        data: task,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting task by ID', { taskId: ctx.params.id, error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Get tasks by user ID
router.get('/user/:userId', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/tasks/user/:userId', async (span) => {
    try {
      const { userId } = ctx.params;
      const status = ctx.query.status as string | undefined;

      span.setAttributes({
        'user.id': userId,
        'query.status': status || 'all',
      });

      const tasks = await taskService.getTasksByUserId(userId, status);

      ctx.body = {
        message: 'Tasks retrieved successfully',
        data: tasks,
        meta: {
          count: tasks.length,
          userId,
          statusFilter: status,
        },
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting tasks by user ID', { userId: ctx.params.userId, error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Update task by ID
router.put('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('PUT /api/tasks/:id', async (span) => {
    try {
      const { id } = ctx.params;
      const updateData = ctx.request.body as {
        title?: string;
        description?: string;
        status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      };

      span.setAttributes({
        'task.id': id,
      });

      const updatedTask = await taskService.updateTask(id, updateData);

      if (!updatedTask) {
        ctx.status = 404;
        ctx.body = {
          error: 'Task not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'Task updated successfully',
        data: updatedTask,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error updating task', { taskId: ctx.params.id, error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Delete task by ID
router.delete('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('DELETE /api/tasks/:id', async (span) => {
    try {
      const { id } = ctx.params;

      span.setAttributes({
        'task.id': id,
      });

      const deleted = await taskService.deleteTask(id);

      if (!deleted) {
        ctx.status = 404;
        ctx.body = {
          error: 'Task not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'Task deleted successfully',
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error deleting task', { taskId: ctx.params.id, error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

// Get task statistics
router.get('/stats/overview', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/tasks/stats/overview', async (span) => {
    try {
      const stats = await taskService.getTaskStats();

      ctx.body = {
        message: 'Task statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting task stats', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 500;
      ctx.body = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      };
    } finally {
      span.end();
    }
  });
});

export default router;