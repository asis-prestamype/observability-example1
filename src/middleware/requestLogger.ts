import { Context, Next } from 'koa';
import { trace } from '@opentelemetry/api';
import logger from '../config/logger';

export const requestLogger = () => {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    const span = trace.getActiveSpan();

    // Log incoming request
    logger.info('Incoming request', {
      method: ctx.method,
      url: ctx.url,
      userAgent: ctx.get('User-Agent'),
      ip: ctx.ip,
      contentType: ctx.get('Content-Type'),
    });

    // Add request information to span
    if (span) {
      span.setAttributes({
        'http.method': ctx.method,
        'http.url': ctx.url,
        'http.user_agent': ctx.get('User-Agent'),
        'http.client_ip': ctx.ip,
        'http.request_content_type': ctx.get('Content-Type'),
      });
    }

    try {
      await next();
    } finally {
      const duration = Date.now() - start;

      // Add response information to span
      if (span) {
        span.setAttributes({
          'http.status_code': ctx.status,
          'http.response_size': ctx.length || 0,
          'http.response_content_type': ctx.type || 'unknown',
          'http.duration_ms': duration,
        });
      }

      // Log response
      const logLevel = ctx.status >= 400 ? 'warn' : 'info';
      logger.log(logLevel, 'Request completed', {
        method: ctx.method,
        url: ctx.url,
        status: ctx.status,
        duration: `${duration}ms`,
        responseSize: ctx.length || 0,
        responseType: ctx.type || 'unknown',
      });
    }
  };
};