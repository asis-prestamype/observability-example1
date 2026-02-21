import { Collection, ObjectId, WithId } from 'mongodb';
import { trace } from '@opentelemetry/api';
import databaseService from '../config/database';
import logger from '../config/logger';

const tracer = trace.getTracer('user-service');

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private get collection(): Collection<User> {
    return databaseService.getDb().collection<User>('users');
  }

  async createUser(userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'>): Promise<WithId<User>> {
    return tracer.startActiveSpan('user_service.create_user', async (span) => {
      try {
        const now = new Date();
        const user: User = {
          ...userData,
          createdAt: now,
          updatedAt: now,
        };

        span.setAttributes({
          'user.email': userData.email,
          'user.name': userData.name,
        });

        const result = await this.collection.insertOne(user);
        const createdUser = await this.collection.findOne({ _id: result.insertedId });

        if (!createdUser) {
          throw new Error('Failed to retrieve created user');
        }

        logger.info('User created successfully', {
          userId: createdUser._id,
          email: createdUser.email,
        });

        span.setStatus({ code: 1 }); // OK
        return createdUser;
      } catch (error) {
        logger.error('Failed to create user', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getUserById(id: string): Promise<WithId<User> | null> {
    return tracer.startActiveSpan('user_service.get_user_by_id', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'user.id': id,
        });

        const user = await this.collection.findOne({ _id: objectId });

        if (user) {
          logger.info('User retrieved successfully', { userId: id });
        } else {
          logger.warn('User not found', { userId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return user;
      } catch (error) {
        logger.error('Failed to get user by ID', { userId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getUserByEmail(email: string): Promise<WithId<User> | null> {
    return tracer.startActiveSpan('user_service.get_user_by_email', async (span) => {
      try {
        span.setAttributes({
          'user.email': email,
        });

        const user = await this.collection.findOne({ email });

        if (user) {
          logger.info('User retrieved by email', { email, userId: user._id });
        } else {
          logger.warn('User not found by email', { email });
        }

        span.setStatus({ code: 1 }); // OK
        return user;
      } catch (error) {
        logger.error('Failed to get user by email', { email, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async getAllUsers(limit = 50, offset = 0): Promise<WithId<User>[]> {
    return tracer.startActiveSpan('user_service.get_all_users', async (span) => {
      try {
        span.setAttributes({
          'query.limit': limit,
          'query.offset': offset,
        });

        const users = await this.collection
          .find({})
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .toArray();

        logger.info('Users retrieved successfully', { count: users.length });

        span.setAttributes({
          'result.count': users.length,
        });
        span.setStatus({ code: 1 }); // OK
        return users;
      } catch (error) {
        logger.error('Failed to get all users', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async updateUser(id: string, updateData: Partial<Omit<User, '_id' | 'createdAt'>>): Promise<WithId<User> | null> {
    return tracer.startActiveSpan('user_service.update_user', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'user.id': id,
        });

        const updatedUser = await this.collection.findOneAndUpdate(
          { _id: objectId },
          { $set: { ...updateData, updatedAt: new Date() } },
          { returnDocument: 'after' }
        );

        if (updatedUser.value) {
          logger.info('User updated successfully', { userId: id });
        } else {
          logger.warn('User not found for update', { userId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return updatedUser.value;
      } catch (error) {
        logger.error('Failed to update user', { userId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteUser(id: string): Promise<boolean> {
    return tracer.startActiveSpan('user_service.delete_user', async (span) => {
      try {
        const objectId = new ObjectId(id);
        span.setAttributes({
          'user.id': id,
        });

        const result = await this.collection.deleteOne({ _id: objectId });
        const deleted = result.deletedCount > 0;

        if (deleted) {
          logger.info('User deleted successfully', { userId: id });
        } else {
          logger.warn('User not found for deletion', { userId: id });
        }

        span.setStatus({ code: 1 }); // OK
        return deleted;
      } catch (error) {
        logger.error('Failed to delete user', { userId: id, error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

export const userService = new UserService();