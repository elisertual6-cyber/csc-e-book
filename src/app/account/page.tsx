import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { staffRoles } from "@/lib/security";
import AccountSecurity from "@/components/account-security";
import Logout from "@/components/logout";
import LearnerDashboard from "@/components/learner-dashboard";
export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <section className="shell section page-content account-page">
      <div className="eyebrow">YOUR STUDY SPACE</div>
      <h1>Hello, {user.name ?? "learner"}.</h1>
      <p className="lead">
        Continue your saved practice, see your recent progress and choose what
        to study next.
      </p>
      <LearnerDashboard />
      <details className="account-tools">
      <summary>Account settings and tools</summary>
      <div className="actions">
        {staffRoles.includes(user.role) && (
          <Link className="button button-light" href="/admin">
            Open editorial studio
          </Link>
        )}
        <Link className="button button-light" href="/account/purchases">
          Orders & downloads
        </Link>
        <Logout />
      </div>
      <AccountSecurity verified={!!user.emailVerifiedAt} />
      <div className="notice">
        No payments are accepted. Registration does not grant paid files or
        premium exam access. Admins may offer free reviewed sessions.
      </div>
      </details>
    </section>
  );
}
