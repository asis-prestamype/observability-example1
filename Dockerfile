# =============================================================================
# Base Stage - Common dependencies and setup
# =============================================================================
FROM public.ecr.aws/docker/library/node:24.13.1-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    dumb-init

# Create non-root user early
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# =============================================================================
# Development Stage - For local development with hot reload
# =============================================================================
FROM base AS development

# Install all dependencies (including devDependencies)
RUN npm ci && npm cache clean --force

# Change ownership and switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Copy source code
COPY --chown=nodejs:nodejs src ./src

# Expose port
EXPOSE 3000

# Health check for development
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start with ts-node-dev for hot reload
CMD ["dumb-init", "npm", "run", "dev"]

# =============================================================================
# Production Builder Stage - Build the application
# =============================================================================
FROM base AS builder

# Install all dependencies for building
RUN npm ci && npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# =============================================================================
# Production Stage - Optimized for production deployment
# =============================================================================
FROM base AS production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership and switch to non-root user
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3000

# Health check for production
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["dumb-init", "node", "dist/index.js"]