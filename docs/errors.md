# Known Errors & Solutions

## TypeError: (responseType ?? responses_1.MongoDBResponse).make is not a function

### Symptoms

The application crashes on startup with the following error:

```
Failed to connect to MongoDB: TypeError: (responseType ?? responses_1.MongoDBResponse).make is not a function
    at Connection.sendWire (/app/node_modules/mongodb/src/cmap/connection.ts:494:60)
    at Connection.sendCommand (...)
    at Connection.command (...)
    at Admin.ping (...)
```

### Root Cause

This is a version incompatibility between the OpenTelemetry MongoDB instrumentation and the MongoDB Node.js driver v6.

The `@opentelemetry/instrumentation-mongodb` (all versions compatible with `@opentelemetry/instrumentation` ≤ 0.46.x, i.e., instrumentation-mongodb ≤ 0.40.x) monkey-patches `Connection.prototype.command` using a 4-parameter wrapper:

```js
function patchedV4ServerCommand(ns, cmd, options, callback) { ... }
```

In **MongoDB driver v4/v5**, `command` was callback-based and the 4th argument was indeed a callback:

```js
async command(ns, command, options, callback)
```

In **MongoDB driver v6**, the API changed to async/await and the 4th argument became `responseType` — a class constructor used to deserialize wire protocol responses:

```js
async command(ns, command, options, responseType)
```

When the instrumentation intercepts the call, it treats `responseType` (a class constructor) as a callback. It then passes a wrapped `patchedCallback` function in place of `responseType` to the original `command`. Inside `command`, this corrupted `responseType` is forwarded to `sendWire`, which tries to call `(responseType ?? MongoDBResponse).make(bson)`. Since the function is not null/undefined, the `??` operator does not fall back to `MongoDBResponse`, and `patchedCallback.make` is `undefined` — causing the TypeError.

### Affected Versions

| Package | Version | Status |
|---|---|---|
| `mongodb` | `^6.x` | Incompatible with OTel instrumentation ≤ 0.40.x |
| `mongodb` | `^5.x` | Compatible |
| `@opentelemetry/instrumentation-mongodb` | `≤ 0.40.x` | Broken with mongodb v6 |
| `@opentelemetry/instrumentation-mongodb` | `≥ 0.41.x` | Fixed, but requires `@opentelemetry/instrumentation` ≥ 0.49.x |

### Solution

Downgrade the MongoDB driver to v5, which retains the callback-based `command` API that the instrumentation correctly handles:

```json
// package.json
"mongodb": "^5.9.2"
```

Then reinstall and rebuild:

```bash
npm install
docker-compose down
docker volume rm observability-example1_node_modules_cache
docker-compose up -d --build
```

### Alternative Solution

If you need MongoDB v6, upgrade the entire OpenTelemetry stack to a version that includes a fixed `instrumentation-mongodb` (≥ 0.41.x), which requires `@opentelemetry/instrumentation` ≥ 0.49.x and a corresponding `@opentelemetry/sdk-node` upgrade.

### Additional Notes

- The `node_modules_cache` Docker named volume persists installed packages across image rebuilds. Any time `package-lock.json` changes, the volume must be deleted before rebuilding to avoid running stale packages:
  ```bash
  docker volume rm observability-example1_node_modules_cache
  docker-compose up -d --build
  ```
- The nested copy of `@opentelemetry/instrumentation-mongodb` inside `node_modules/@opentelemetry/auto-instrumentations-node/node_modules/` takes precedence over the top-level installation. Upgrading the top-level package alone is not sufficient — `@opentelemetry/auto-instrumentations-node` must also be upgraded to deduplicate to the newer version.
- Setting `OTEL_TRACES_EXPORTER=jaeger` causes `@opentelemetry/sdk-node` ≥ 0.45 to throw `unsupported opentelemetry tracer jaeger`. Since the Jaeger exporter is configured programmatically in `src/tracing.ts`, this environment variable should be omitted.
