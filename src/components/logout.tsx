"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function Logout() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="button"
        onClick={async () => {
          try {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSC-Action": "1",
              },
              body: "{}",
            });
            if (response.ok) {
              router.push("/login");
              router.refresh();
            } else setError("Sign out failed. Please retry.");
          } catch {
            setError("Sign out failed. Please retry.");
          }
        }}
      >
        Sign out
      </button>
      <span role="status">{error}</span>
    </>
  );
}
