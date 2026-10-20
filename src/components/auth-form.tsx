"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const response = await fetch(
            `/api/auth/${register ? "register" : "login"}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSC-Action": "1",
              },
              body: JSON.stringify(data),
            },
          );
          const result = await response.json();
          if (!response.ok) setMessage(result.error);
          else {
            router.push("/account");
            router.refresh();
          }
        } catch {
          setMessage("Unable to connect. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {register && (
        <>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </>
      )}
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        name="email"
        required
        autoComplete="email"
        maxLength={254}
      />
      <label htmlFor="password">Password (12–128 characters)</label>
      <input
        id="password"
        type="password"
        name="password"
        required
        minLength={12}
        maxLength={128}
        autoComplete={register ? "new-password" : "current-password"}
      />
      <button className="button" disabled={busy}>
        {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
      </button>
      <p role="status">{message}</p>
      <p>
        {register ? "Already have an account?" : "New here?"}{" "}
        <Link className="text-link" href={register ? "/login" : "/register"}>
          {register ? "Sign in" : "Create an account"}
        </Link>
      </p>
      {!register && (
        <p>
          <Link className="text-link" href="/forgot-password">
            Forgot your password?
          </Link>
        </p>
      )}
      <p className="fine-print">
        Development service. Email verification and recovery depend on a
        configured mail service. Do not reuse a password from another service.
      </p>
    </form>
  );
}
