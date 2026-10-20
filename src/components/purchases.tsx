"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { commerceRequest, pesos } from "@/lib/commerce-client";
type Order = {
  id: string;
  status: string;
  paymentMethod: string;
  paymentSession: { state: string } | null;
  totalMinor: number;
  createdAt: string;
  items: { productName: string | null; productVersion: string | null }[];
  notices: { transport: string }[];
  entitlements: {
    productId: string;
    revokedAt: string | null;
    expiresAt: string | null;
    product: {
      artifacts: { id: string; version: string; developmentOnly: boolean }[];
    };
  }[];
};
type History = { id: string; issuedAt: string; consumedAt: string | null }[];
export default function Purchases() {
  const [orders, setOrders] = useState<Order[] | null>(null),
    [history, setHistory] = useState<History>([]),
    [development, setDevelopment] = useState(false),
    [sandbox, setSandbox] = useState(false),
    [paymentUrl, setPaymentUrl] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState<string | null>(null);
  async function load() {
    const [o, c, h] = await Promise.all([
      commerceRequest<Order[]>("/api/commerce/orders"),
      commerceRequest<{ development: boolean; sandbox: boolean }>(
        "/api/commerce/catalog",
      ),
      commerceRequest<History>("/api/commerce/downloads"),
    ]);
    setOrders(o);
    setDevelopment(c.development);
    setSandbox(c.sandbox);
    setHistory(h);
  }
  useEffect(() => {
    Promise.all([
      commerceRequest<Order[]>("/api/commerce/orders"),
      commerceRequest<{ development: boolean; sandbox: boolean }>(
        "/api/commerce/catalog",
      ),
      commerceRequest<History>("/api/commerce/downloads"),
    ])
      .then(([o, c, h]) => {
        setOrders(o);
        setDevelopment(c.development);
        setSandbox(c.sandbox);
        setHistory(h);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function action(orderId: string, action: string) {
    setBusy(true);
    setError("");
    try {
      await commerceRequest(`/api/commerce/orders/${orderId}`, { action });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(artifactId: string) {
    setBusy(true);
    setError("");
    setLink(null);
    try {
      const result = await commerceRequest<{ url: string }>(
        "/api/commerce/downloads",
        { artifactId },
      );
      setLink(result.url);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function gcash(orderId: string, action: "checkout" | "refresh") {
    setBusy(true);
    setError("");
    setPaymentUrl(null);
    try {
      const result = await commerceRequest<{ checkoutUrl?: string | null }>(
        `/api/commerce/orders/${orderId}/gcash`,
        { action },
      );
      if (result.checkoutUrl) setPaymentUrl(result.checkoutUrl);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {development && (
        <p className="notice">
          Development simulation: no funds are collected. A simulated payment
          creates test access only. Purchase emails require a verified address
          and configured email delivery.
        </p>
      )}
      {sandbox && (
        <div className="notice">
          GCash sandbox only. No real money is collected. Returning from
          checkout does not confirm payment; use “Check GCash status” while
          confirmation is pending.
        </div>
      )}
      {paymentUrl && (
        <div className="notice">
          <a className="button" href={paymentUrl} rel="noreferrer">
            Continue to GCash sandbox
          </a>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {link && (
        <div className="notice">
          <a
            href={link}
            download
            rel="noreferrer"
            onClick={() => setLink(null)}
          >
            Download PDF now
          </a>
          <p>
            This private link is tied to your account, lasts five minutes and
            can be used once. Request a new link if needed.
          </p>
        </div>
      )}
      {!orders && !error && <p role="status">Loading your library…</p>}
      {orders?.length === 0 && (
        <p>
          No orders yet. <Link href="/shop">Browse editions</Link>.
        </p>
      )}
      <div className="commerce-orders">
        {orders?.map((o) => (
          <article key={o.id} className="panel">
            <div className="eyebrow">{o.status}</div>
            <h2>
              {o.items.map((i) => i.productName ?? "Study edition").join(", ")}
            </h2>
            <p>
              {pesos(o.totalMinor)} ·{" "}
              <time dateTime={o.createdAt}>
                {new Date(o.createdAt).toLocaleDateString("en-PH", {
                  timeZone: "Asia/Singapore",
                })}
              </time>
            </p>
            <p className="order-reference">Order {o.id}</p>
            {o.paymentMethod === "gcash" && (
              <>
                <p>
                  Payment method: GCash · Sandbox ·{" "}
                  {o.paymentSession?.state ?? "Not started"}
                </p>
                <div className="actions">
                  {o.status === "PENDING" && (
                    <button
                      disabled={busy || !sandbox}
                      className="button"
                      onClick={() => gcash(o.id, "checkout")}
                    >
                      Pay with GCash (sandbox)
                    </button>
                  )}
                  {o.paymentSession && (
                    <button
                      disabled={busy || !sandbox}
                      className="button button-light"
                      onClick={() => gcash(o.id, "refresh")}
                    >
                      Check GCash status
                    </button>
                  )}
                </div>
              </>
            )}
            {o.status === "PENDING" &&
              o.paymentMethod !== "gcash" &&
              development && (
                <div className="actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => action(o.id, "simulatePayment")}
                  >
                    Simulate successful payment
                  </button>
                  <button
                    className="button button-light"
                    disabled={busy}
                    onClick={() => action(o.id, "cancel")}
                  >
                    Cancel order
                  </button>
                </div>
              )}
            {o.status === "PAID" &&
              o.entitlements
                .filter(
                  (e) =>
                    !e.revokedAt &&
                    (!e.expiresAt || new Date(e.expiresAt) > new Date()),
                )
                .flatMap((e) =>
                  e.product.artifacts
                    .filter(
                      (a) =>
                        o.items.some((i) => i.productVersion === a.version) &&
                        (!a.developmentOnly || development || sandbox),
                    )
                    .map((a) => (
                      <button
                        key={a.id}
                        className="button button-light"
                        disabled={busy}
                        onClick={() => download(a.id)}
                      >
                        {a.developmentOnly
                          ? "Request draft test PDF"
                          : "Request private PDF"}{" "}
                        · v{a.version}
                      </button>
                    )),
                )}
            {o.notices.some((n) => n.transport === "development-outbox") && (
              <p>
                Purchase notice recorded in development outbox. Email not sent.
              </p>
            )}{" "}
            {o.notices.some((n) => n.transport === "smtp-queued") && (
              <p>Purchase email queued.</p>
            )}
            {o.notices.some((n) => n.transport === "smtp-accepted") && (
              <p>Purchase notification submitted to the email service.</p>
            )}
            {o.notices.some((n) => n.transport === "development-file") && (
              <p>Development notification copy saved. Email not sent.</p>
            )}
          </article>
        ))}
      </div>
      {history.length > 0 && (
        <section>
          <h2>Recent download activity</h2>
          <ul>
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.issuedAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Singapore",
                })}{" "}
                · {h.consumedAt ? "File delivered" : "Link issued"}
              </li>
            ))}
          </ul>
          <p>Refresh after downloading to update delivery status.</p>
        </section>
      )}
    </>
  );
}
