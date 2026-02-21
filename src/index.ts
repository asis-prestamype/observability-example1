// Initialize tracing before importing other modules
import { initializeTracing } from './tracing';
initializeTracing();

import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import cors from 'koa-cors';
import helmet from 'koa-helmet';
import koaLogger from 'koa-logger';
import dotenv from 'dotenv';
import { trace } from '@opentelemetry/api';

// Load environment variables
dotenv.config();

// Import configurations and middleware
import databaseService from './config/database';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import userRoutes from './routes/userRoutes';
import taskRoutes from './routes/taskRoutes';
import healthRoutes from './routes/healthRoutes';

const tracer = trace.getTracer('main-app');

class App {
  private app: Koa;
  private port: number;

  constructor() {
    this.app = new Koa();
    this.port = parseInt(process.env.PORT || '3000');
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Error handling middleware (should be first)
    this.app.use(errorHandler());

    // Security middleware
    this.app.use(helmet());

    // CORS middleware
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Body parser middleware
    this.app.use(bodyParser({
      enableTypes: ['json', 'form'],
      jsonLimit: '10mb',
      formLimit: '10mb',
    }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.app.use(koaLogger());
    }
    this.app.use(requestLogger());
  }

  private setupRoutes(): void {
    // Health check routes (no prefix)
    this.app.use(healthRoutes.routes());
    this.app.use(healthRoutes.allowedMethods());

    // API routes
    this.app.use(userRoutes.routes());
    this.app.use(userRoutes.allowedMethods());

    this.app.use(taskRoutes.routes());
    this.app.use(taskRoutes.allowedMethods());

    // Root endpoint
    this.app.use(async (ctx, next) => {
      if (ctx.path === '/' && ctx.method === 'GET') {
        ctx.body = {
          message: 'Koa Observability API',
          version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
          timestamp: new Date().toISOString(),
          endpoints: {
            health: '/health',
            healthDetailed: '/health/detailed',
            users: '/api/users',
            tasks: '/api/tasks',
            taskStats: '/api/tasks/stats/overview',
          },
        };
      } else {
        await next();
      }
    });

    // 404 handler
    this.app.use(async (ctx) => {
      ctx.status = 404;
      ctx.body = {
        error: 'Not Found',
        message: `The requested resource ${ctx.path} was not found`,
        timestamp: new Date().toISOString(),
      };
    });
  }

  private setupErrorHandling(): void {
    // Global error event handler
    this.app.on('error', (err, ctx) => {
      logger.error('Unhandled application error', {
        error: err.message,
        stack: err.stack,
        url: ctx?.url,
        method: ctx?.method,
        status: ctx?.status,
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception', {
        error: err.message,
        stack: err.stack,
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise,
      });
    });
  }

  public async start(): Promise<void> {
    return tracer.startActiveSpan('app.start', async (span) => {
      try {
        // Connect to database
        await databaseService.connect();

        // Start HTTP server
        this.app.listen(this.port, () => {
          logger.info('Server started successfully', {
            port: this.port,
            env: process.env.NODE_ENV || 'development',
            nodeVersion: process.version,
            serviceName: process.env.OTEL_SERVICE_NAME,
            serviceVersion: process.env.OTEL_SERVICE_VERSION,
          });
        });

        span.setAttributes({
          'app.port': this.port,
          'app.env': process.env.NODE_ENV || 'development',
          'app.node_version': process.version,
        });

        span.setStatus({ code: 1 }); // OK
      } catch (error) {
        logger.error('Failed to start server', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }

  public async stop(): Promise<void> {
    return tracer.startActiveSpan('app.stop', async (span) => {
      try {
        logger.info('Shutting down server...');

        // Close database connection
        await databaseService.disconnect();

        logger.info('Server shutdown completed');
        span.setStatus({ code: 1 }); // OK
      } catch (error) {
        logger.error('Error during server shutdown', { error: (error as Error).message });
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
        throw error;
      } finally {
        span.end();
      }
    });
  }
}

// Create and start the application
const app = new App();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  try {
    await app.stop();
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: (error as Error).message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the application
app.start().catch((error) => {
  logger.error('Failed to start application', { error: error.message });
  process.exit(1);
});