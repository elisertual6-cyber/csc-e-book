import RecoveryForm from "@/components/recovery-form";
export const metadata = { referrer: "no-referrer" as const };
export default function Page() {
  return (
    <section className="shell section page-content">
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Confirm your email.</h1>
      <p className="lead">
        Confirm ownership of the address associated with your account.
      </p>
      <RecoveryForm mode="verify" />
    </section>
  );
}
