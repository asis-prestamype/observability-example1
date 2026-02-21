import { Context, Next } from 'koa';
import { trace } from '@opentelemetry/api';
import logger from '../config/logger';

export interface ApiError extends Error {
  status?: number;
  expose?: boolean;
}

export const errorHandler = () => {
  return async (ctx: Context, next: Next) => {
    const span = trace.getActiveSpan();

    try {
      await next();
    } catch (err) {
      const error = err as ApiError;

      // Log the error with trace information
      logger.error('Request error', {
        error: error.message,
        stack: error.stack,
        url: ctx.url,
        method: ctx.method,
        status: error.status,
        userAgent: ctx.get('User-Agent'),
        ip: ctx.ip,
      });

      // Add error information to span
      if (span) {
        span.recordException(error);
        span.setStatus({
          code: 2, // ERROR
          message: error.message,
        });
        span.setAttributes({
          'error.type': error.constructor.name,
          'http.status_code': error.status || 500,
        });
      }

      // Set response status and body
      ctx.status = error.status || 500;
      ctx.body = {
        error: {
          message: error.expose ? error.message : 'Internal Server Error',
          status: ctx.status,
          timestamp: new Date().toISOString(),
          path: ctx.url,
          method: ctx.method,
          ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
        },
      };

      // Emit error event for monitoring
      ctx.app.emit('error', error, ctx);
    }
  };
};