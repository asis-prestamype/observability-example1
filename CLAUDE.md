# Koa Observability API

A complete Koa.js application with comprehensive observability using MongoDB, Docker, Jaeger tracing, and AWS Distro OpenTelemetry auto-instrumentation.

## Features

- **Framework**: Koa.js with TypeScript
- **Database**: MongoDB with connection pooling and health checks
- **Observability**:
  - Distributed tracing with Jaeger
  - AWS Distro OpenTelemetry auto-instrumentation
  - Structured logging with Winston
  - Custom spans and error tracking
- **Containerization**: Docker with docker-compose
- **API**: RESTful endpoints for users and tasks
- **Health Checks**: Kubernetes-ready health, readiness, and liveness probes
- **Security**: Helmet.js security headers and CORS
- **Error Handling**: Comprehensive error handling and logging

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- npm or yarn

### Using Docker (Recommended)

The project includes a multi-stage Dockerfile with optimized builds for development and production environments.

#### Development Mode (with hot reloading)

1. Clone and navigate to the project:
```bash
cd ~/sb/observability/example1
```

2. Start all services in development mode:
```bash
npm run docker:up
```

This uses the `development` stage and provides:
- **Hot reloading** with ts-node-dev for instant feedback
- **API Server**: http://localhost:3000
- **MongoDB**: http://localhost:27017
- **Jaeger UI**: http://localhost:16686
- **Source code mounting** for live updates
- **Debug logging** enabled

3. View logs:
```bash
npm run docker:logs
```

4. Stop all services:
```bash
npm run docker:down
```

#### Production Mode (optimized deployment)

For production deployment, use the optimized production build:

1. Start production services:
```bash
npm run docker:up:prod
```

2. View production logs:
```bash
npm run docker:logs:prod
```

3. Stop production services:
```bash
npm run docker:down:prod
```

The production build includes:
- **Compiled TypeScript** for better performance
- **Minimal image size** with only production dependencies
- **Resource constraints** for better resource management
- **Optimized security** with non-root user

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start MongoDB and Jaeger with Docker:
```bash
docker-compose up mongodb jaeger -d
```

4. Run the application in development mode:
```bash
npm run dev
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with dependencies
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)

### Users
- `POST /api/users` - Create a new user
- `GET /api/users` - Get all users (with pagination)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user by ID
- `DELETE /api/users/:id` - Delete user by ID

### Tasks
- `POST /api/tasks` - Create a new task
- `GET /api/tasks` - Get all tasks (with pagination and filtering)
- `GET /api/tasks/:id` - Get task by ID
- `GET /api/tasks/user/:userId` - Get tasks by user ID
- `PUT /api/tasks/:id` - Update task by ID
- `DELETE /api/tasks/:id` - Delete task by ID
- `GET /api/tasks/stats/overview` - Get task statistics

## Example API Calls

### Create a User
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john6@example.com"
  }'
```

### Create a Task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete project",
    "description": "Finish the observability project",
    "userId": "USER_ID_FROM_PREVIOUS_CALL",
    "status": "pending"
  }'
```

### Get All Tasks
```bash
curl http://localhost:3000/api/tasks
```

## Observability

### Jaeger Tracing

Access the Jaeger UI at http://localhost:16686 to view distributed traces. The application automatically instruments:

- HTTP requests/responses
- MongoDB operations
- Custom business logic spans
- Error tracking and exceptions

### Logging

The application uses structured logging with Winston, including:
- Request/response logging
- Database operation logging
- Error logging with stack traces
- Trace correlation (trace/span IDs in logs)

### Health Monitoring

Monitor the application health using the health check endpoints:
- `/health` - Quick health status
- `/health/detailed` - Comprehensive health with dependency status
- `/health/ready` - For Kubernetes readiness probes
- `/health/live` - For Kubernetes liveness probes

## Environment Variables

Create a `.env` file with the following variables:

```env
# Application Configuration
NODE_ENV=development
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://admin:password@localhost:27017/observability?authSource=admin

# OpenTelemetry Configuration
OTEL_SERVICE_NAME=koa-observability-api
OTEL_SERVICE_VERSION=1.0.0
OTEL_EXPORTER_JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_TRACES_EXPORTER=jaeger
OTEL_LOGS_EXPORTER=console

# Logging Configuration
LOG_LEVEL=info
```

## Project Structure

```
src/
├── config/
│   ├── database.ts      # MongoDB connection and health checks
│   └── logger.ts        # Winston logging configuration
├── middleware/
│   ├── errorHandler.ts  # Global error handling
│   └── requestLogger.ts # Request/response logging
├── routes/
│   ├── healthRoutes.ts  # Health check endpoints
│   ├── taskRoutes.ts    # Task CRUD operations
│   └── userRoutes.ts    # User CRUD operations
├── services/
│   ├── taskService.ts   # Task business logic
│   └── userService.ts   # User business logic
├── tracing.ts           # OpenTelemetry setup
└── index.ts            # Application entry point
```

## Development

### Available Scripts

#### Local Development
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run dev` - Start development server with hot reload

#### Docker Commands
- `npm run docker:build` - Build production Docker image
- `npm run docker:build:dev` - Build development Docker image
- `npm run docker:build:prod` - Build production Docker image (explicit)

#### Development Environment
- `npm run docker:up` - Start all services in development mode
- `npm run docker:down` - Stop development services
- `npm run docker:logs` - View development container logs

#### Production Environment
- `npm run docker:up:prod` - Start all services in production mode
- `npm run docker:down:prod` - Stop production services
- `npm run docker:logs:prod` - View production container logs

#### Testing and Linting
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Docker Architecture

The project uses a multi-stage Dockerfile for optimal build efficiency and deployment flexibility:

### Build Stages

1. **Base Stage (`base`)**
   - Common Node.js 24.13.1 Alpine base image
   - System dependencies (curl, dumb-init)
   - Non-root user setup
   - Package files copying

2. **Development Stage (`development`)**
   - Inherits from base stage
   - Installs ALL dependencies (including devDependencies)
   - Mounts source code as volumes for hot reloading
   - Uses `ts-node-dev` for instant feedback
   - Debug logging enabled
   - Perfect for local development

3. **Builder Stage (`builder`)**
   - Temporary stage for TypeScript compilation
   - Installs all dependencies needed for building
   - Compiles TypeScript to JavaScript
   - Output used by production stage

4. **Production Stage (`production`)**
   - Inherits from base stage
   - Installs ONLY production dependencies
   - Copies compiled JavaScript from builder stage
   - Minimal image size and attack surface
   - Optimized for deployment

### File Structure

```
Docker Files:
├── Dockerfile              # Multi-stage Dockerfile
├── docker-compose.yml      # Development environment
├── docker-compose.prod.yml # Production environment
└── .dockerignore          # Optimized build context
```

### Benefits

- **Development**: Fast rebuilds, hot reloading, full debugging capabilities
- **Production**: Minimal size (~50MB), security hardened, optimal performance
- **Consistency**: Same base image and Node.js version across all stages
- **Efficiency**: Layer caching and optimized dependency installation

### Adding New Endpoints

1. Create service methods in `src/services/`
2. Add routes in `src/routes/`
3. Include custom tracing spans for observability
4. Add proper error handling and logging

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running: `docker-compose up mongodb -d`
   - Check connection string in `.env`

2. **Jaeger Traces Not Appearing**
   - Verify Jaeger is running: `docker-compose up jaeger -d`
   - Check Jaeger endpoint configuration

3. **Port Already in Use**
   - Change the PORT in `.env` file
   - Or stop the service using the port: `lsof -ti:3000 | xargs kill`

### Logs

View application logs:
```bash
# Docker
npm run docker:logs

# Local development
npm run dev  # logs appear in console
```

## License

MIT