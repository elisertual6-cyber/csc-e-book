// Node-only provider protocol. No public API accepts an API base, key or verified status.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./http";
type Env = Record<string, string | undefined>;
const resourceId = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`))
    .max(100);
export const checkoutId = resourceId("cs");
export const paymentId = resourceId("pay");
const refund = z.object({
  id: resourceId("ref"),
  attributes: z.object({
    amount: z.number().int().nonnegative(),
    currency: z.literal("PHP"),
    payment_id: paymentId,
    livemode: z.literal(false),
    status: z.string(),
  }),
});
export const paymentResource = z.object({
  id: paymentId,
  type: z.literal("payment"),
  attributes: z.object({
    amount: z.number().int().positive(),
    currency: z.literal("PHP"),
    livemode: z.literal(false),
    status: z.string(),
    payment_intent_id: z.string().min(1),
    source: z.object({ type: z.literal("gcash") }),
    refunds: z
      .array(refund)
      .nullable()
      .transform((v) => v ?? []),
  }),
});
export const checkoutResource = z.object({
  id: checkoutId,
  type: z.literal("checkout_session"),
  attributes: z.object({
    livemode: z.literal(false),
    checkout_url: z.string().url(),
    reference_number: z.string().min(1),
    metadata: z.object({
      order_id: z.string().min(1),
      local_session_id: z.string().min(1),
    }),
    payment_method_types: z.array(z.string()),
    line_items: z
      .array(
        z.object({
          amount: z.number().int().positive(),
          currency: z.literal("PHP"),
          quantity: z.number().int().positive(),
        }),
      )
      .min(1),
    payment_intent: z.object({
      id: z.string().min(1),
      attributes: z.object({ status: z.string() }),
    }),
    payments: z.array(z.object({ id: paymentId })).default([]),
  }),
});
export type CheckoutResource = z.infer<typeof checkoutResource>;
export type PaymentResource = z.infer<typeof paymentResource>;
export function paymongoConfig(env: Env = process.env) {
  if (
    env.NODE_ENV === "production" ||
    env.PAYMENT_PROVIDER !== "paymongo" ||
    env.PAYMONGO_MODE !== "test" ||
    env.GCASH_CHECKOUT_ENABLED !== "true" ||
    !env.PAYMONGO_SECRET_KEY?.startsWith("sk_test_") ||
    !env.PAYMONGO_WEBHOOK_SECRET
  )
    throw new HttpError(
      503,
      "GCash checkout is not enabled. No payment will be collected.",
    );
  let base = "https://api.paymongo.com/v1";
  // A loopback emulator is permitted only in the generated disposable test database.
  if (env.PAYMONGO_TEST_API_ORIGIN) {
    const origin = new URL(env.PAYMONGO_TEST_API_ORIGIN),
      database = new URL(env.DATABASE_URL ?? "postgresql://invalid/invalid")
        .pathname;
    if (
      !/^\/csc_e2e_[a-f0-9]{16}$/.test(database) ||
      origin.protocol !== "http:" ||
      origin.hostname !== "127.0.0.1" ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash
    )
      throw new HttpError(503, "Payment test configuration is invalid.");
    base = origin.origin + "/v1";
  }
  const app = new URL(env.APP_URL ?? "http://localhost:3000");
  if (
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== "/" ||
    !["http:", "https:"].includes(app.protocol)
  )
    throw new HttpError(503, "The payment return origin is invalid.");
  return {
    base,
    secretKey: env.PAYMONGO_SECRET_KEY,
    webhookSecret: env.PAYMONGO_WEBHOOK_SECRET,
    appOrigin: app.origin,
  };
}
export function gcashCheckoutEnabled() {
  try {
    paymongoConfig();
    return true;
  } catch {
    return false;
  }
}
export function trustedCheckoutUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.paymongo.com" ||
    url.port ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/")
  )
    throw new HttpError(
      502,
      "The payment provider returned an invalid checkout link.",
    );
  return url.toString();
}
export function verifyPaymongoSignature(
  body: Uint8Array,
  header: string | null,
  secret: string,
  timeSeconds = Math.floor(Date.now() / 1000),
) {
  if (!header || header.length > 1024)
    throw new HttpError(401, "Payment signature could not be verified.");
  const entries = header.split(",").map((s) => s.trim().split("="));
  const values = new Map<string, string>();
  for (const entry of entries) {
    if (
      entry.length !== 2 ||
      !["t", "te", "li"].includes(entry[0]) ||
      values.has(entry[0])
    )
      throw new HttpError(401, "Payment signature could not be verified.");
    values.set(entry[0], entry[1]);
  }
  const timestamp = values.get("t") ?? "",
    signature = values.get("te") ?? "";
  if (
    !/^\d{1,12}$/.test(timestamp) ||
    Math.abs(timeSeconds - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !!values.get("li")
  )
    throw new HttpError(401, "Payment signature could not be verified.");
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(body)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    throw new HttpError(401, "Payment signature could not be verified.");
}
function providerResult<T extends z.ZodType>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new HttpError(
      502,
      "The payment provider returned an invalid result.",
    );
  return parsed.data;
}
export class PaymongoClient {
  constructor(
    private config = paymongoConfig(),
    private fetcher: typeof fetch = fetch,
  ) {}
  private async request(
    method: "GET" | "POST",
    route: string,
    attributes?: unknown,
  ) {
    let response: Response;
    try {
      response = await this.fetcher(this.config.base + route, {
        method,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Basic ${Buffer.from(this.config.secretKey + ":").toString("base64")}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body:
          attributes === undefined
            ? undefined
            : JSON.stringify({ data: { attributes } }),
      });
    } catch {
      throw new HttpError(
        502,
        "The payment provider could not be reached. Check the existing order before trying again.",
      );
    }
    if (!response.ok)
      throw new HttpError(
        502,
        "The payment provider did not accept this request. Check the existing order before trying again.",
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new HttpError(502, "The payment provider returned no result.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 2_000_000) {
        await reader.cancel();
        throw new HttpError(
          502,
          "The payment provider returned an invalid result.",
        );
      }
      chunks.push(next.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        data: unknown;
      };
    } catch {
      throw new HttpError(
        502,
        "The payment provider returned an invalid result.",
      );
    }
  }
  async create(
    order: {
      id: string;
      totalMinor: number;
      currency: string;
      items: {
        productName: string | null;
        unitPriceMinor: number;
        quantity: number;
      }[];
    },
    localSessionId: string,
  ) {
    const result = await this.request("POST", "/checkout_sessions", {
      payment_method_types: ["gcash"],
      reference_number: order.id,
      metadata: { order_id: order.id, local_session_id: localSessionId },
      description: "CSC Study independent reviewer — sandbox checkout",
      line_items: order.items.map((i) => ({
        name: i.productName ?? "Study edition",
        amount: i.unitPriceMinor,
        currency: order.currency,
        quantity: i.quantity,
      })),
      success_url: `${this.config.appOrigin}/account/purchases?payment_return=1`,
      cancel_url: `${this.config.appOrigin}/account/purchases?payment_return=1`,
      send_email_receipt: false,
      show_description: true,
      show_line_items: true,
    });
    return providerResult(checkoutResource, result.data);
  }
  async checkout(id: string) {
    const result = await this.request(
      "GET",
      `/checkout_sessions/${checkoutId.parse(id)}`,
    );
    return providerResult(checkoutResource, result.data);
  }
  async payment(id: string) {
    const result = await this.request(
      "GET",
      `/payments/${paymentId.parse(id)}`,
    );
    return providerResult(paymentResource, result.data);
  }
}
export const paymongoEvent = z.object({
  data: z.object({
    id: resourceId("evt"),
    type: z.literal("event"),
    attributes: z.object({
      type: z.string().min(1).max(100),
      livemode: z.literal(false),
      data: z.object({ id: z.string().min(1).max(100), type: z.string() }),
    }),
  }),
});
