import AuthForm from "@/components/auth-form";
import { currentUser, registrationEnabled } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function Register() {
  if (await currentUser()) redirect("/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">BUILD YOUR STUDY HABIT</div>
      <h1>Start your next chapter.</h1>
      {registrationEnabled() ? (
        <AuthForm register />
      ) : (
        <p className="notice">Registration is not open on this deployment.</p>
      )}
    </section>
  );
}
