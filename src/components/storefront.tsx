"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commerceRequest, pesos } from "@/lib/commerce-client";
type Catalog = {
  development: boolean;
  sandbox: boolean;
  checkoutAvailable: boolean;
  products: {
    id: string;
    name: string;
    description: string;
    version: string;
    grantsExams: boolean;
    price: { id: string; amountMinor: number };
  }[];
};
export default function Storefront() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [checkoutKeys] = useState(() => new Map<string, string>());
  useEffect(() => {
    commerceRequest<Catalog>("/api/commerce/catalog")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  async function buy(priceId: string) {
    setBusy(true);
    setError("");
    try {
      let key = checkoutKeys.get(priceId);
      if (!key) {
        key = crypto.randomUUID();
        checkoutKeys.set(priceId, key);
      }
      await commerceRequest("/api/commerce/orders", {
        priceId,
        checkoutKey: key,
      });
      router.push("/account/purchases");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        {catalog?.sandbox
          ? "GCash sandbox checkout only. No real funds are collected. Verify your email before creating a test order."
          : catalog?.development
            ? "Development simulation only. No money is collected. Draft proofs are for testing and are not commercial editions."
            : "Sales are not open. Payment processing remains disabled while editorial review and gateway verification are pending."}
      </div>
      <p className="payment-method">
        <strong>Customer payment method: GCash</strong>
        {!catalog?.sandbox && " · Live checkout is not open yet."}
      </p>
      {error && (
        <p role="alert">
          {error} <Link href="/login">Sign in</Link>
        </p>
      )}
      {!catalog && !error && <p role="status">Loading editions…</p>}
      {catalog?.products.length === 0 && (
        <div className="panel">
          <h2>Still in the editorial studio.</h2>
          <p>
            No released editions are available yet. Read the draft lesson or try
            the free practice demo while we prepare.
          </p>
          <Link className="button button-light" href="/preview">
            Read a sample lesson
          </Link>
        </div>
      )}
      <div className="commerce-grid">
        {catalog?.products.map((p) => (
          <article className="panel" key={p.id}>
            <div className="eyebrow">EDITION {p.version}</div>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            <p className="price">{pesos(p.price.amountMinor)}</p>
            <p>
              {p.grantsExams
                ? "Includes eligible premium practice sessions."
                : "PDF study edition."}
            </p>
            <button
              className="button"
              disabled={busy || !catalog.checkoutAvailable}
              onClick={() => buy(p.price.id)}
            >
              {busy
                ? "Creating order…"
                : catalog.sandbox
                  ? "Create GCash sandbox order"
                  : catalog.development
                    ? "Create simulated order"
                    : "Checkout unavailable"}
            </button>
          </article>
        ))}
      </div>
      <p>
        <Link href="/account/purchases">View orders & downloads</Link>
      </p>
    </>
  );
}
