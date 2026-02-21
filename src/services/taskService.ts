import { Collection, ObjectId, WithId } from 'mongodb';
import { trace } from '@opentelemetry/api';
import databaseService from '../config/database';
import logger from '../config/logger';

const tracer = trace.getTracer('task-service');

export interface Task {
  _id?: ObjectId;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  userId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export class TaskService {
  private get collection(): Collection<Task> {
    return databaseService.getDb().collection<Task>('tasks');
  }

  async createTask(taskData: Omit<Task, '_id' | 'createdAt' | 'updatedAt'>): Promise<WithId<Task>> {
    return tracer.startActiveSpan('task_service.create_task', async (span) => {
      try {
        const now = new Date();
        const task: Task = {
          ...taskData,
          createdAt: now,
          updatedAt: now,
        };

        span.setAttributes({
          'task.title': taskData.title,
          'task.status': taskData.status,
          'task.user_id': taskData.userId.toString(),
        });

        const result = await this.collection.insertOne(task);
        const createdTask = await this.collection.findOne({ _id: result.insertedId });

        if (!createdTask) {
          throw new Error('Failed to retrieve created task');
        }

        logger.info('Task created successfully', {
          taskId: createdTask._id,
          title: createdTask.title,
          userId: createdTask.userId,
        });

        span.setStatus({ code: 1 }); // OK
        return createdTask;
      } catch (error) {
        logger.error('Failed to create task', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getTaskById(id: string): Promise<WithId<Task> | null> {
    return tracer.startActiveSpan('task_service.get_task_by_id', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'task.id': id,
        });

        const task = await this.collection.findOne({ _id: objectId });

        if (task) {
          logger.info('Task retrieved successfully', { taskId: id });
        } else {
          logger.warn('Task not found', { taskId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return task;
      } catch (error) {
        logger.error('Failed to get task by ID', { taskId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getTasksByUserId(userId: string, status?: string): Promise<WithId<Task>[]> {
    return tracer.startActiveSpan('task_service.get_tasks_by_user_id', async (span) => {
      try {
        const userObjectId = new ObjectId(userId);
        const filter: any = { userId: userObjectId };

        if (status) {
          filter.status = status;
        }

        span.setAttributes({
          'task.user_id': userId,
          'task.status_filter': status || 'all',
        });

        const tasks = await this.collection
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

        logger.info('Tasks retrieved by user ID', {
          userId,
          count: tasks.length,
          statusFilter: status
        });

        span.setAttributes({
          'result.count': tasks.length,
        });
        span.setStatus({ code: 1 }); // OK
        return tasks;
      } catch (error) {
        logger.error('Failed to get tasks by user ID', { userId, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getAllTasks(limit = 50, offset = 0, status?: string): Promise<WithId<Task>[]> {
    return tracer.startActiveSpan('task_service.get_all_tasks', async (span) => {
      try {
        const filter: any = {};
        if (status) {
          filter.status = status;
        }

        span.setAttributes({
          'query.limit': limit,
          'query.offset': offset,
          'query.status_filter': status || 'all',
        });

        const tasks = await this.collection
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        logger.info('Tasks retrieved successfully', {
          count: tasks.length,
          statusFilter: status
        });

        span.setAttributes({
          'result.count': tasks.length,
        });
        span.setStatus({ code: 1 }); // OK
        return tasks;
      } catch (error) {
        logger.error('Failed to get all tasks', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async updateTask(id: string, updateData: Partial<Omit<Task, '_id' | 'createdAt'>>): Promise<WithId<Task> | null> {
    return tracer.startActiveSpan('task_service.update_task', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'task.id': id,
        });

        const updatedTask = await this.collection.findOneAndUpdate(
          { _id: objectId },
          { $set: { ...updateData, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );

        if (updatedTask.value) {
          logger.info('Task updated successfully', { taskId: id });
        } else {
          logger.warn('Task not found for update', { taskId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return updatedTask.value;
      } catch (error) {
        logger.error('Failed to update task', { taskId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    return tracer.startActiveSpan('task_service.delete_task', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'task.id': id,
        });

        const result = await this.collection.deleteOne({ _id: objectId });
        const deleted = result.deletedCount > 0;

        if (deleted) {
          logger.info('Task deleted successfully', { taskId: id });
        } else {
          logger.warn('Task not found for deletion', { taskId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return deleted;
      } catch (error) {
        logger.error('Failed to delete task', { taskId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getTaskStats(): Promise<{ total: number; byStatus: Record<string, number> }> {
    return tracer.startActiveSpan('task_service.get_task_stats', async (span) => {
      try {
        const pipeline = [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ];

        const statusCounts = await this.collection.aggregate(pipeline).toArray();
        const total = await this.collection.countDocuments();

        const byStatus: Record<string, number> = {};
        statusCounts.forEach(item => {
          byStatus[item._id] = item.count;
        });

        logger.info('Task stats retrieved', { total, byStatus });

        span.setAttributes({
          'stats.total': total,
          'stats.pending': byStatus.pending || 0,
          'stats.in_progress': byStatus.in_progress || 0,
          'stats.completed': byStatus.completed || 0,
          'stats.cancelled': byStatus.cancelled || 0,
        });
        span.setStatus({ code: 1 }); // OK

        return { total, byStatus };
      } catch (error) {
        logger.error('Failed to get task stats', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

export const taskService = new TaskService();