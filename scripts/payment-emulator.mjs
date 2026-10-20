// Disposable-database test fixture only. It never contacts PayMongo or GCash.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
const database = new URL(
  process.env.DATABASE_URL ?? "postgresql://invalid/invalid",
).pathname;
if (
  process.env.NODE_ENV === "production" ||
  !/^\/csc_e2e_[a-f0-9]{16}$/.test(database) ||
  !process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_test_fixture_") ||
  !process.env.PAYMONGO_WEBHOOK_SECRET
)
  throw new Error("Payment fixture requires generated test resources.");
const sessions = new Map(),
  payments = new Map();
let failNext = false,
  creations = 0;
const key =
  "Basic " +
  Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64");
const send = (res, status, value) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
};
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      send(res, 200, { status: "fixture-only" });
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 256000) {
        send(res, 413, {});
        return;
      }
      chunks.push(chunk);
    }
    const body = chunks.length
      ? JSON.parse(Buffer.concat(chunks).toString())
      : {};
    if (req.url === "/control") {
      if (
        req.headers["x-fixture-secret"] !== process.env.PAYMONGO_WEBHOOK_SECRET
      ) {
        send(res, 403, {});
        return;
      }
      if (body.action === "fail-next") {
        failNext = true;
        send(res, 200, {});
        return;
      }
      if (body.action === "find") {
        send(res, 200, {
          sessions: [...sessions.values()].filter(
            (s) => s.attributes.reference_number === body.orderId,
          ),
          creations,
        });
        return;
      }
      const session = sessions.get(body.id);
      if (!session) {
        send(res, 404, {});
        return;
      }
      if (
        body.action === "pay" ||
        body.action === "refund" ||
        body.action === "stale-paid"
      ) {
        if (!session.attributes.payments.length) {
          const id = "pay_" + randomBytes(8).toString("hex");
          const amount = session.attributes.line_items.reduce(
            (n, i) => n + i.amount * i.quantity,
            0,
          );
          payments.set(id, {
            id,
            type: "payment",
            attributes: {
              amount,
              currency: "PHP",
              livemode: false,
              status: "paid",
              payment_intent_id: session.attributes.payment_intent.id,
              source: { type: "gcash" },
              refunds: [],
            },
          });
          session.attributes.payments = [{ id }];
        }
        const payment = payments.get(session.attributes.payments[0].id);
        session.attributes.payment_intent.attributes.status = "succeeded";
        if (body.action === "refund")
          payment.attributes.refunds = [
            {
              id: "ref_" + randomBytes(8).toString("hex"),
              attributes: {
                amount: body.amount ?? payment.attributes.amount,
                currency: "PHP",
                payment_id: payment.id,
                livemode: false,
                status: "succeeded",
              },
            },
          ];
        if (body.action === "stale-paid") payment.attributes.refunds = [];
      }
      if (body.action === "patch-payment") {
        const p = payments.get(session.attributes.payments[0]?.id);
        if (!p) {
          send(res, 404, {});
          return;
        }
        Object.assign(p.attributes, body.attributes);
      }
      if (body.action === "patch-session")
        Object.assign(session.attributes, body.attributes);
      send(res, 200, {
        session,
        payment: payments.get(session.attributes.payments[0]?.id),
      });
      return;
    }
    if (req.headers.authorization !== key) {
      send(res, 401, {});
      return;
    }
    if (req.method === "POST" && req.url === "/v1/checkout_sessions") {
      const a = body.data?.attributes;
      if (
        JSON.stringify(a?.payment_method_types) !== '["gcash"]' ||
        !a?.metadata?.local_session_id
      ) {
        send(res, 400, {});
        return;
      }
      const id = "cs_" + randomBytes(8).toString("hex");
      const session = {
        id,
        type: "checkout_session",
        attributes: {
          livemode: false,
          checkout_url: "https://checkout.paymongo.com/" + id,
          reference_number: a.reference_number,
          metadata: a.metadata,
          payment_method_types: a.payment_method_types,
          line_items: a.line_items,
          payment_intent: {
            id: "pi_" + randomBytes(8).toString("hex"),
            attributes: { status: "awaiting_payment_method" },
          },
          payments: [],
        },
      };
      sessions.set(id, session);
      creations++;
      if (failNext) {
        failNext = false;
        send(res, 500, { error: "Synthetic ambiguous response" });
        return;
      }
      send(res, 200, { data: session });
      return;
    }
    const checkout = /^\/v1\/checkout_sessions\/(cs_[a-zA-Z0-9]+)$/.exec(
      req.url ?? "",
    );
    if (checkout) {
      const data = sessions.get(checkout[1]);
      send(res, data ? 200 : 404, { data });
      return;
    }
    const payment = /^\/v1\/payments\/(pay_[a-zA-Z0-9]+)$/.exec(req.url ?? "");
    if (payment) {
      const data = payments.get(payment[1]);
      send(res, data ? 200 : 404, { data });
      return;
    }
    send(res, 404, {});
  } catch {
    send(res, 400, { error: "Invalid fixture request" });
  }
});
server.listen(3201, "127.0.0.1", () =>
  console.log("Local payment fixture ready. No real gateway requests."),
);
