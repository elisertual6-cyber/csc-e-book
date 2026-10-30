import AuthForm from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Login({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const library = (await searchParams).from === "library";
  if (await currentUser()) redirect(library ? "/account/purchases" : "/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">YOUR LEARNING SPACE</div>
      <h1>Welcome back.</h1>
      {library && <p className="lead">Sign in with the account used for your purchase to open your reviewer library.</p>}
      <AuthForm library={library} />
    </section>
  );
}
