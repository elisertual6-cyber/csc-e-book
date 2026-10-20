"use client";
import { useState } from "react";
import Link from "next/link";
export default function AccountSecurity({ verified }: { verified: boolean }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function request() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: "{}",
      });
      const data = await r.json();
      setMessage(data.message ?? data.error);
    } catch {
      setMessage("Unable to connect. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-security panel">
      <h2>Account security</h2>
      <p>
        {verified
          ? "Email address verified."
          : "Your email address has not been verified."}
      </p>
      {!verified && (
        <button
          className="button button-light"
          disabled={busy}
          onClick={request}
        >
          {busy ? "Requesting…" : "Send verification email"}
        </button>
      )}
      <p role="status">{message}</p>
      <p>
        <Link href="/forgot-password">Reset your password</Link>
      </p>
      <p className="fine-print">
        Messages use this deployment’s configured mail service. Development
        inbox messages are not delivered to a real mailbox.
      </p>
    </section>
  );
}
