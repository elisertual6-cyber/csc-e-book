import { randomUUID } from "node:crypto";

export type ApiOperation = "auth" | "admin" | "commerce" | "exam" | "preview" | "health" | "live";
export type FailureCategory = "expected" | "validation" | "not_found" | "conflict" | "internal";

// Deliberately accepts no Request, URL, exception, body, identity or headers.
// Incoming trace IDs are not trusted or copied into application logs.
export function requestObservation(operation: ApiOperation) {
  const requestId = randomUUID();
  const started = performance.now();
  return {
    requestId,
    complete(response: Response, failure?: FailureCategory) {
      response.headers.set("X-Request-ID", requestId);
      if (process.env.OBSERVABILITY_LOGS === "true" || response.status >= 500) {
        const entry = JSON.stringify({
          event: "api_response",
          timestamp: new Date().toISOString(),
          requestId,
          operation,
          status: response.status,
          durationMs: Math.max(0, Math.round(performance.now() - started)),
          ...(failure ? { failure } : {}),
        });
        // Logging must not turn a committed operation into an HTTP failure.
        try {
          if (response.status >= 500) console.error(entry);
          else console.info(entry);
        } catch { /* A broken log sink must not change payment/auth outcomes. */ }
      }
      return response;
    },
  };
}
