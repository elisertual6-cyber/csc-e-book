import RecoveryForm from "@/components/recovery-form";
export const metadata = { referrer: "no-referrer" as const };
export default function Page() {
  return (
    <section className="shell section page-content">
      <div className="eyebrow">ACCOUNT SECURITY</div>
      <h1>Choose a new password.</h1>
      <p className="lead">Use a unique password with at least 12 characters.</p>
      <RecoveryForm mode="reset" />
    </section>
  );
}
