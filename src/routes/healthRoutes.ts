import Router from 'koa-router';
import { Context } from 'koa';
import { trace } from '@opentelemetry/api';
import databaseService from '../config/database';
import logger from '../config/logger';

const router = new Router({ prefix: '/health' });
const tracer = trace.getTracer('health-routes');

// Basic health check
router.get('/', async (ctx: Context) => {
  ctx.body = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  };
});

// Detailed health check with dependencies
router.get('/detailed', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /health/detailed', async (span) => {
    try {
      const checks = {
        application: { status: 'ok', timestamp: new Date().toISOString() },
        database: { status: 'unknown', latency: 0 },
      };

      // Check database connectivity
      try {
        const dbHealth = await databaseService.healthCheck();
        checks.database = {
          status: 'ok',
          latency: dbHealth.latency,
        };
      } catch (error) {
        checks.database = {
          status: 'error',
          latency: 0,
          error: (error as Error).message,
        };
      }

      // Determine overall status
      const isHealthy = Object.values(checks).every(check => check.status === 'ok');
      const overallStatus = isHealthy ? 'ok' : 'degraded';

      span.setAttributes({
        'health.overall_status': overallStatus,
        'health.database_status': checks.database.status,
        'health.database_latency': checks.database.latency,
      });

      ctx.status = isHealthy ? 200 : 503;
      ctx.body = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.OTEL_SERVICE_VERSION || '1.0.0',
        checks,
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 503;
      ctx.body = {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      };
    } finally {
      span.end();
    }
  });
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (ctx: Context) => {
  await tracer.startActiveSpan('GET /health/ready', async (span) => {
    try {
      // Check if database is connected and accessible
      if (!databaseService.isConnected()) {
        throw new Error('Database not connected');
      }

      // Quick database ping
      await databaseService.healthCheck();

      span.setAttributes({
        'readiness.database_connected': true,
      });

      ctx.body = {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.warn('Readiness check failed', { error: (error as Error).message });
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR

      ctx.status = 503;
      ctx.body = {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };
    } finally {
      span.end();
    }
  });
});

// Liveness probe (for Kubernetes)
router.get('/live', async (ctx: Context) => {
  // Simple liveness check - just return that the server is running
  ctx.body = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
});

export default router;