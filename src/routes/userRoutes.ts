import Router from 'koa-router';
import { Context } from 'koa';
import { userService } from '../services/userService';
import { trace } from '@opentelemetry/api';
import logger from '../config/logger';

const router = new Router({ prefix: '/api/users' });
const tracer = trace.getTracer('user-routes');

// Create a new user
router.post('/', async (ctx: Context) => {
  await tracer.startActiveSpan('POST /api/users', async (span) => {
    try {
      const { name, email } = ctx.request.body as { name: string; email: string };

      if (!name || !email) {
        ctx.status = 400;
        ctx.body = {
          error: 'Name and email are required',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        ctx.status = 409;
        ctx.body = {
          error: 'User with this email already exists',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      const user = await userService.createUser({ name, email });

      span.setAttributes({
        'user.created.id': user._id.toString(),
        'user.created.email': user.email,
      });

      ctx.status = 201;
      ctx.body = {
        message: 'User created successfully',
        data: user,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error creating user', { error: (error as Error).message });
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

// Get all users
router.get('/', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/users', async (span) => {
    try {
      const limit = parseInt(ctx.query.limit as string) || 50;
      const offset = parseInt(ctx.query.offset as string) || 0;

      const users = await userService.getAllUsers(limit, offset);

      span.setAttributes({
        'query.limit': limit,
        'query.offset': offset,
        'result.count': users.length,
      });

      ctx.body = {
        message: 'Users retrieved successfully',
        data: users,
        meta: {
          count: users.length,
          limit,
          offset,
        },
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting users', { error: (error as Error).message });
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

// Get user by ID
router.get('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /api/users/:id', async (span) => {
    try {
      const { id } = ctx.params;

      span.setAttributes({
        'user.id': id,
      });

      const user = await userService.getUserById(id);

      if (!user) {
        ctx.status = 404;
        ctx.body = {
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'User retrieved successfully',
        data: user,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error getting user by ID', { userId: ctx.params.id, error: (error as Error).message });
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

// Update user by ID
router.put('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('PUT /api/users/:id', async (span) => {
    try {
      const { id } = ctx.params;
      const updateData = ctx.request.body as { name?: string; email?: string };

      span.setAttributes({
        'user.id': id,
      });

      if (updateData.email) {
        // Check if email is already taken by another user
        const existingUser = await userService.getUserByEmail(updateData.email);
        if (existingUser && existingUser._id.toString() !== id) {
          ctx.status = 409;
          ctx.body = {
            error: 'Email already taken by another user',
            timestamp: new Date().toISOString(),
          };
          return;
        }
      }

      const updatedUser = await userService.updateUser(id, updateData);

      if (!updatedUser) {
        ctx.status = 404;
        ctx.body = {
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'User updated successfully',
        data: updatedUser,
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error updating user', { userId: ctx.params.id, error: (error as Error).message });
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

// Delete user by ID
router.delete('/:id', async (ctx: Context) => {
  await tracer.startActiveSpan('DELETE /api/users/:id', async (span) => {
    try {
      const { id } = ctx.params;

      span.setAttributes({
        'user.id': id,
      });

      const deleted = await userService.deleteUser(id);

      if (!deleted) {
        ctx.status = 404;
        ctx.body = {
          error: 'User not found',
          timestamp: new Date().toISOString(),
        };
        return;
      }

      ctx.body = {
        message: 'User deleted successfully',
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Error deleting user', { userId: ctx.params.id, error: (error as Error).message });
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