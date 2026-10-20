import AuthForm from "@/components/auth-form";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Login() {
  if (await currentUser()) redirect("/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">YOUR LEARNING SPACE</div>
      <h1>Welcome back.</h1>
      <AuthForm />
    </section>
  );
}
