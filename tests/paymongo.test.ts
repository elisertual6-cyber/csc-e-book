import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  PaymongoClient,
  paymongoConfig,
  trustedCheckoutUrl,
  verifyPaymongoSignature,
} from "../src/lib/paymongo";
import { isTestPaymentProvider } from "../src/lib/payment-policy";
const settings = {
  NODE_ENV: "development",
  PAYMENT_PROVIDER: "paymongo",
  PAYMONGO_MODE: "test",
  GCASH_CHECKOUT_ENABLED: "true",
  PAYMONGO_SECRET_KEY: "sk_test_synthetic",
  PAYMONGO_WEBHOOK_SECRET: "synthetic-signing-secret",
  APP_URL: "http://localhost:3000",
};
const remote = {
  id: "cs_unit",
  type: "checkout_session",
  attributes: {
    livemode: false,
    checkout_url: "https://checkout.paymongo.com/test",
    reference_number: "order1",
    metadata: { order_id: "order1", local_session_id: "local1" },
    payment_method_types: ["gcash"],
    line_items: [{ amount: 9900, currency: "PHP", quantity: 1 }],
    payment_intent: {
      id: "pi_unit",
      attributes: { status: "awaiting_payment_method" },
    },
    payments: [],
  },
};
describe("GCash sandbox protocol", () => {
  it("verifies raw-body test signatures and rejects tampering, stale/live and ambiguous headers", () => {
    const body = Buffer.from('{"message":"Pagsasanay sa Filipino"}'),
      time = 1700000000,
      secret = "fixture-secret";
    const sig = createHmac("sha256", secret)
        .update(`${time}.`)
        .update(body)
        .digest("hex"),
      header = `t=${time},te=${sig},li=`;
    expect(() =>
      verifyPaymongoSignature(body, header, secret, time),
    ).not.toThrow();
    expect(() =>
      verifyPaymongoSignature(Buffer.from("{}"), header, secret, time),
    ).toThrow();
    expect(() =>
      verifyPaymongoSignature(body, header, secret, time + 301),
    ).toThrow();
    expect(() =>
      verifyPaymongoSignature(body, header, secret, time - 301),
    ).toThrow();
    expect(() =>
      verifyPaymongoSignature(body, `t=${time},te=,li=${sig}`, secret, time),
    ).toThrow();
    expect(() =>
      verifyPaymongoSignature(body, header + ",te=" + sig, secret, time),
    ).toThrow();
    expect(() => verifyPaymongoSignature(body, null, secret, time)).toThrow();
  });
  it("keeps live and production checkout off without all explicit matching settings", () => {
    expect(paymongoConfig(settings).base).toBe("https://api.paymongo.com/v1");
    for (const patch of [
      { NODE_ENV: "production" },
      { PAYMONGO_MODE: "live" },
      { PAYMONGO_SECRET_KEY: "sk_live_invalid" },
      { GCASH_CHECKOUT_ENABLED: "false" },
      { PAYMONGO_WEBHOOK_SECRET: "" },
      {
        PAYMONGO_TEST_API_ORIGIN: "http://127.0.0.1:9999",
        DATABASE_URL: "postgresql://user@localhost/production",
      },
    ])
      expect(() => paymongoConfig({ ...settings, ...patch })).toThrow();
    expect(
      paymongoConfig({
        ...settings,
        PAYMONGO_TEST_API_ORIGIN: "http://127.0.0.1:9999",
        DATABASE_URL: "postgresql://user@localhost/csc_e2e_0123456789abcdef",
      }).base,
    ).toBe("http://127.0.0.1:9999/v1");
    expect(isTestPaymentProvider("paymongo_test")).toBe(true);
    expect(isTestPaymentProvider("mock")).toBe(true);
  });
  it("accepts an explicitly configured live deployment and rejects key, origin and emulator mode confusion", () => {
    const live = { ...settings, NODE_ENV: "production", PAYMONGO_MODE: "live", GCASH_LIVE_ENABLED: "true", PAYMONGO_SECRET_KEY: "sk_live_synthetic", APP_URL: "https://csc-e-book.vercel.app" };
    expect(paymongoConfig(live)).toMatchObject({ mode: "live", base: "https://api.paymongo.com/v1" });
    for (const patch of [{ NODE_ENV: "development" }, { GCASH_LIVE_ENABLED: "false" }, { PAYMONGO_SECRET_KEY: "sk_test_synthetic" }, { APP_URL: "http://localhost:3000" }, { APP_URL: "https://localhost" }, { PAYMONGO_TEST_API_ORIGIN: "http://127.0.0.1:3201" }]) expect(() => paymongoConfig({ ...live, ...patch })).toThrow();
  });
  it("binds a live signature to its live slot, body and timestamp", () => {
    const body = Buffer.from('{"livemode":true}'), time = 1700000000, secret = "fixture-live";
    const signature = createHmac("sha256", secret).update(`${time}.`).update(body).digest("hex");
    expect(() => verifyPaymongoSignature(body, `t=${time},te=,li=${signature}`, secret, time, "live")).not.toThrow();
    for (const header of [`t=${time},te=${signature},li=`, `t=${time},te=${signature},li=${signature}`, `t=${time},li=${"0".repeat(64)}`]) expect(() => verifyPaymongoSignature(body, header, secret, time, "live")).toThrow();
    expect(() => verifyPaymongoSignature(body, `t=${time},li=${signature}`, secret, time + 301, "live")).toThrow();
  });
  it("can verify existing payments while sales are paused, but a confirmation client cannot create a checkout", async () => {
    const paused = { ...settings, NODE_ENV: "production", PAYMONGO_MODE: "live", GCASH_LIVE_ENABLED: "false", GCASH_CHECKOUT_ENABLED: "false", PAYMONGO_SECRET_KEY: "sk_live_synthetic", APP_URL: "https://csc-e-book.vercel.app" };
    expect(() => paymongoConfig(paused)).toThrow();
    const config = paymongoConfig(paused, true);
    const fetcher = async () => Response.json({ data: { ...remote, attributes: { ...remote.attributes, livemode: true } } });
    const client = new PaymongoClient(config, fetcher);
    expect((await client.checkout(remote.id)).attributes.livemode).toBe(true);
    await expect(client.create({ id: "order1", totalMinor: 9900, currency: "PHP", items: [{ productName: "Reviewer", unitPriceMinor: 9900, quantity: 1 }] }, "local1")).rejects.toThrow("New checkouts are paused");
  });
  it("never treats a response from a different payment mode as a valid checkout", async () => {
    const live = paymongoConfig({ ...settings, NODE_ENV: "production", PAYMONGO_MODE: "live", GCASH_LIVE_ENABLED: "true", PAYMONGO_SECRET_KEY: "sk_live_synthetic", APP_URL: "https://csc-e-book.vercel.app" });
    const client = new PaymongoClient(live, async () => Response.json({ data: remote }));
    await expect(client.checkout(remote.id)).rejects.toThrow("different payment mode");
    const accepted = new PaymongoClient(live, async () => Response.json({ data: { ...remote, attributes: { ...remote.attributes, livemode: true } } }));
    expect((await accepted.checkout(remote.id)).attributes.livemode).toBe(true);
  });
  it("restricts hosted payment links to the exact trusted HTTPS host", () => {
    expect(trustedCheckoutUrl(remote.attributes.checkout_url)).toBe(
      remote.attributes.checkout_url,
    );
    for (const url of [
      "javascript:alert(1)",
      "https://checkout.paymongo.com.attacker.test/",
      "http://checkout.paymongo.com/",
      "https://user:password@checkout.paymongo.com/",
      "https://checkout.paymongo.com:9999/",
    ])
      expect(() => trustedCheckoutUrl(url)).toThrow();
  });
  it("creates a GCash-only session using server centavos, immutable metadata and trusted return URLs", async () => {
    let called = false;
    const client = new PaymongoClient(
      paymongoConfig(settings),
      async (input, init) => {
        called = true;
        expect(input).toBe("https://api.paymongo.com/v1/checkout_sessions");
        expect(init?.redirect).toBe("error");
        const data = JSON.parse(init!.body as string).data.attributes;
        expect(data.payment_method_types).toEqual(["gcash"]);
        expect(data.line_items).toEqual([
          { name: "Test reviewer", amount: 9900, currency: "PHP", quantity: 1 },
        ]);
        expect(data.metadata).toEqual({
          order_id: "order1",
          local_session_id: "local1",
        });
        expect(data.success_url).toBe(
          "http://localhost:3000/account/purchases?payment_return=1",
        );
        expect(data.send_email_receipt).toBe(false);
        return Response.json({ data: remote });
      },
    );
    expect(
      (
        await client.create(
          {
            id: "order1",
            totalMinor: 9900,
            currency: "PHP",
            items: [
              {
                productName: "Test reviewer",
                unitPriceMinor: 9900,
                quantity: 1,
              },
            ],
          },
          "local1",
        )
      ).id,
    ).toBe("cs_unit");
    expect(called).toBe(true);
  });
  it("returns safe errors for malformed provider responses and ambiguous request failures", async () => {
    const bad = new PaymongoClient(paymongoConfig(settings), async () =>
      Response.json({ data: { secret: "must not leak" } }),
    );
    await expect(bad.checkout("cs_unit")).rejects.toMatchObject({
      status: 502,
    });
    const timeout = new PaymongoClient(paymongoConfig(settings), async () => {
      throw new Error(settings.PAYMONGO_SECRET_KEY);
    });
    await expect(timeout.checkout("cs_unit")).rejects.toMatchObject({
      status: 502,
    });
  });
});
