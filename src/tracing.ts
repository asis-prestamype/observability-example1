import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { MongoDBInstrumentation } from "@opentelemetry/instrumentation-mongodb";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  KoaInstrumentation,
  KoaLayerType,
} from "@opentelemetry/instrumentation-koa";

// Initialize OpenTelemetry with OTLP exporter (Jaeger supports OTLP natively)
export const initializeTracing = () => {
  const otlpExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://jaeger:4318/v1/traces",
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || "koa-observability-api",
      [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || "1.0.0",
      "service.instance.id": `${process.env.HOSTNAME || "localhost"}-${process.pid}`,
    }),
    traceExporter: otlpExporter,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook(req) {
          return req.url?.includes("/health") || false;
        },
      }),
      new MongoDBInstrumentation({
        enabled: true,
      }),
      new KoaInstrumentation({
        // Only keep router spans — drops bodyParser, logger, allowedMethods, etc.
        ignoreLayersType: [KoaLayerType.MIDDLEWARE],
      }),
    ],
  });

  sdk.start();

  console.log("OpenTelemetry tracing initialized successfully");

  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Tracing terminated"))
      .catch((error) => console.log("Error terminating tracing", error))
      .finally(() => process.exit(0));
  });

  return sdk;
};
