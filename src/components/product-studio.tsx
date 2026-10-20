"use client";
import { useEffect, useState, type FormEvent } from "react";
import { commerceRequest, pesos } from "@/lib/commerce-client";
type Product = {
  id: string;
  name: string;
  version: string;
  active: boolean;
  prices: { id: string; amountMinor: number; active: boolean }[];
  artifacts: { id: string; developmentOnly: boolean }[];
};
type AdminOrder = {
  id: string;
  userId: string;
  paymentMethod: string;
  paymentSession: { state: string; providerSessionId: string | null } | null;
  status: string;
  totalMinor: number;
  payments: { provider: string; status: string }[];
  entitlements: { id: string; revokedAt: string | null }[];
};
export default function ProductStudio() {
  const [products, setProducts] = useState<Product[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [development, setDevelopment] = useState(false);
  async function load() {
    const [recent, catalog, products] = await Promise.all([
      commerceRequest<AdminOrder[]>("/api/admin/orders"),
      commerceRequest<{ development: boolean }>("/api/commerce/catalog"),
      commerceRequest<Product[]>("/api/admin/products"),
    ]);
    setOrders(recent);
    setDevelopment(catalog.development);
    setProducts(products);
  }
  useEffect(() => {
    Promise.all([
      commerceRequest<AdminOrder[]>("/api/admin/orders"),
      commerceRequest<{ development: boolean }>("/api/commerce/catalog"),
      commerceRequest<Product[]>("/api/admin/products"),
    ])
      .then(([recent, catalog, products]) => {
        setOrders(recent);
        setDevelopment(catalog.development);
        setProducts(products);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function send(body: unknown, endpoint = "/api/admin/products") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await commerceRequest(endpoint, body);
      await load();
      setMessage("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void send({
      action: "create",
      data: {
        slug: f.get("slug"),
        name: f.get("name"),
        description: f.get("description"),
        version: f.get("version"),
        grantsExams: f.get("grantsExams") === "on",
      },
      amountMinor: Number(f.get("amountMinor")),
    });
  }
  return (
    <>
      <p className="notice">
        Products start inactive. Release requires a matching PDF version and
        confirmation of full human review. Commercial full editions require 500
        unique independently approved questions. Draft proofs can be attached
        only in development mock mode.
      </p>
      <form className="panel exam-form" onSubmit={create}>
        <h2>Create a product</h2>
        <label>
          Slug
          <input name="slug" required pattern="[a-z0-9-]+" />
        </label>
        <label>
          Name
          <input name="name" required minLength={3} />
        </label>
        <label>
          Description
          <textarea name="description" required minLength={10} />
        </label>
        <label>
          Version
          <input name="version" required />
        </label>
        <label>
          Price in centavos (PHP)
          <input
            name="amountMinor"
            type="number"
            min="100"
            max="10000000"
            step="1"
            required
          />
        </label>
        <label>
          <input name="grantsExams" type="checkbox" /> Includes premium sessions
        </label>
        <button className="button" disabled={busy}>
          Create inactive product
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="commerce-grid">
        {products.map((p) => (
          <article key={p.id} className="panel">
            <h2>{p.name}</h2>
            <p>
              Version {p.version} · {p.active ? "Active" : "Inactive"}
            </p>
            <p>
              {p.prices
                .filter((x) => x.active)
                .map((x) => pesos(x.amountMinor))
                .join(", ") || "No active price"}
            </p>
            <p>{p.artifacts.length} attached file(s)</p>
            <form
              className="exam-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send({
                  action: "price",
                  id: p.id,
                  amountMinor: Number(f.get("amountMinor")),
                });
              }}
            >
              <label>
                Replacement price in centavos
                <input
                  name="amountMinor"
                  type="number"
                  min="100"
                  max="10000000"
                  step="1"
                  required
                />
              </label>
              <button disabled={busy} className="button button-light">
                Save new price
              </button>
            </form>
            <form
              className="exam-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send({
                  action: "release",
                  id: p.id,
                  editionId: f.get("editionId"),
                  humanReviewed: true,
                });
              }}
            >
              <label>
                PDF edition ID
                <input name="editionId" required />
              </label>
              <label>
                <input type="checkbox" required /> I reviewed the entire PDF,
                references and notices. Draft attachment is a development test
                only.
              </label>
              <button disabled={busy} className="button button-light">
                Attach reviewed edition
              </button>
            </form>
            <button
              disabled={busy}
              className="button"
              onClick={() =>
                send({ action: "activate", id: p.id, active: !p.active })
              }
            >
              {p.active ? "Deactivate" : "Activate after validation"}
            </button>
          </article>
        ))}
      </div>
      <section>
        <h2>Recent orders & access</h2>
        <p>
          At most 100 recent orders. Restoring access always requires a coherent
          verified paid order; it cannot override expiry or refunds.
        </p>
        <div className="commerce-orders">
          {orders.map((o) => (
            <article className="panel" key={o.id}>
              <p className="order-reference">
                {o.id} · Customer {o.userId}
              </p>
              <h3>
                {o.status} · {pesos(o.totalMinor)}
              </h3>
              <p>
                {o.payments
                  .map((p) => `${p.provider}: ${p.status}`)
                  .join(", ") || "No payment"}
              </p>
              {o.paymentMethod === "gcash" && o.paymentSession && (
                <form
                  className="exam-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void send(
                      {
                        orderId: o.id,
                        providerSessionId: f.get("providerSessionId"),
                      },
                      "/api/admin/payments",
                    );
                  }}
                >
                  <p>GCash sandbox session: {o.paymentSession.state}</p>
                  <label>
                    PayMongo checkout session ID
                    <input
                      name="providerSessionId"
                      defaultValue={o.paymentSession.providerSessionId ?? ""}
                      required
                      pattern="cs_[a-zA-Z0-9]+"
                    />
                  </label>
                  <button className="button button-light" disabled={busy}>
                    Reconcile sandbox payment
                  </button>
                </form>
              )}
              {o.entitlements.map((e) => (
                <button
                  disabled={busy}
                  className="button button-light"
                  key={e.id}
                  onClick={() =>
                    send(
                      { entitlementId: e.id, granted: !!e.revokedAt },
                      "/api/admin/orders",
                    )
                  }
                >
                  {e.revokedAt
                    ? "Restore purchased access"
                    : "Revoke purchased access"}
                </button>
              ))}
              {development &&
                o.status === "PAID" &&
                o.payments.some((p) => p.provider === "mock") && (
                  <button
                    disabled={busy}
                    className="button button-light"
                    onClick={() => send({ action: "refundMock", id: o.id })}
                  >
                    Reverse simulated payment
                  </button>
                )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
