"use client";
import { useSyncExternalStore, useState, type FormEvent } from "react";
import Link from "next/link";
const subscribeHash = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const hashSnapshot = () => window.location.hash;
const serverHash = () => null;
type Mode = "request" | "verify" | "reset";
export default function RecoveryForm({ mode }: { mode: Mode }) {
  const hash = useSyncExternalStore(subscribeHash, hashSnapshot, serverHash);
  const token = new URLSearchParams((hash ?? "").slice(1)).get("token") ?? "";
  const ready = mode === "request" || hash !== null;
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      if (mode === "reset" && f.get("password") !== f.get("confirmPassword")) {
        setMessage("The passwords do not match.");
        return;
      }
      const endpoint =
        mode === "request"
          ? "request-reset"
          : mode === "verify"
            ? "verify-email"
            : "reset-password";
      const body =
        mode === "request"
          ? { email: f.get("email") }
          : mode === "verify"
            ? { token }
            : { token, password: f.get("password") };
      const r = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setMessage(data.message ?? data.error);
      if (r.ok) {
        setDone(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      setMessage("Unable to connect. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const invalid =
    ready && mode !== "request" && !/^[a-f0-9]{64}$/.test(token) && !done;
  return (
    <div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "request" && (
          <>
            <label htmlFor="recovery-email">Email</label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </>
        )}
        {mode === "reset" && !done && (
          <>
            <label htmlFor="new-password">
              New password (12–128 characters)
            </label>
            <input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </>
        )}
        {invalid && (
          <p role="alert">
            This link is missing or invalid. Request a fresh email and open its
            full link.
          </p>
        )}
        {!done && (
          <button className="button" disabled={busy || !ready || invalid}>
            {busy
              ? "Please wait…"
              : mode === "request"
                ? "Request reset email"
                : mode === "verify"
                  ? "Confirm email address"
                  : "Save new password"}
          </button>
        )}
        <p role="status">{message}</p>
      </form>
      <div className="actions">
        <Link className="text-link" href="/login">
          Back to sign in
        </Link>
        <Link className="text-link" href="/account">
          Your account
        </Link>
        {mode !== "request" && (
          <Link className="text-link" href="/forgot-password">
            Request password reset
          </Link>
        )}
      </div>
      <p className="fine-print">
        Email links expire and work once. Opening a link does not change your
        account until you submit. Password reset signs out all sessions.
      </p>
    </div>
  );
}
