import { ZodError } from "zod";
import { requestObservation, type ApiOperation, type FailureCategory } from "./observability";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function assertMutation(request: Request) {
  const configured = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (
    request.headers.get("origin") !== configured.origin ||
    request.headers.get("x-csc-action") !== "1"
  )
    throw new HttpError(403, "Request origin could not be verified.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use application/json.");
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000) {
        await reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function api(operation: ApiOperation, action: () => Promise<Response>) {
  const observation = requestObservation(operation);
  let failure: FailureCategory | undefined;
  let response: Response;
  try {
    response = await action();
  } catch (error) {
    if (error instanceof HttpError) {
      failure = "expected";
      response = json({ error: error.message }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", "60");
    } else if (error instanceof ZodError) {
      failure = "validation";
      response = json(
        {
          error:
            "Invalid input. Check required fields, lengths and option values.",
        },
        400,
      );
    } else {
      const code = (error as { code?: string })?.code;
      if (code === "P2025") {
        failure = "not_found";
        response = json({ error: "Record not found." }, 404);
      } else if (code === "P2002" || code === "P2034" || code === "P2003") {
        failure = "conflict";
        response = json(
          {
            error:
              "The record conflicts with another change. Refresh and try again.",
          },
          409,
        );
      } else {
        failure = "internal";
        response = json({ error: "The request could not be completed." }, 500);
      }
    }
  }
  return observation.complete(response, failure);
}
