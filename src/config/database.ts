import { MongoClient, Db, MongoClientOptions } from 'mongodb';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('database-service');

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private readonly uri: string;
  private readonly dbName: string;

  constructor() {
    this.uri = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/observability?authSource=admin';
    this.dbName = 'observability';
  }

  async connect(): Promise<void> {
    return tracer.startActiveSpan('database.connect', async (span) => {
      try {
        const options: MongoClientOptions = {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4, // Use IPv4, skip trying IPv6
        };

        this.client = new MongoClient(this.uri, options);
        await this.client.connect();
        this.db = this.client.db(this.dbName);

        // Test the connection
        await this.db.admin().ping();

        console.log('Successfully connected to MongoDB');
        span.setStatus({ code: 1 }); // OK
        span.setAttributes({
          'db.system': 'mongodb',
          'db.name': this.dbName,
          'db.connection_string': this.uri.replace(/\/\/.*@/, '//***:***@'), // Hide credentials in spans
        });
      } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async disconnect(): Promise<void> {
    return tracer.startActiveSpan('database.disconnect', async (span) => {
      try {
        if (this.client) {
          await this.client.close();
          this.client = null;
          this.db = null;
          console.log('Disconnected from MongoDB');
        }
        span.setStatus({ code: 1 }); // OK
      } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    return tracer.startActiveSpan('database.health_check', async (span) => {
      const startTime = Date.now();
      try {
        if (!this.db) {
          throw new Error('Database not connected');
        }

        await this.db.admin().ping();
        const latency = Date.now() - startTime;

        span.setAttributes({
          'db.operation': 'ping',
          'db.latency_ms': latency,
        });
        span.setStatus({ code: 1 }); // OK

        return { status: 'healthy', latency };
      } catch (error) {
        const latency = Date.now() - startTime;
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

export const databaseService = new DatabaseService();
export default databaseService;