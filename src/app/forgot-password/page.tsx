import RecoveryForm from "@/components/recovery-form";
export const metadata = { referrer: "no-referrer" as const };
export default function Page() {
  return (
    <section className="shell section page-content">
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Find your way back.</h1>
      <p className="lead">
        Enter your account email to request a password reset. Messages require a
        configured mail service.
      </p>
      <RecoveryForm mode="request" />
    </section>
  );
}
