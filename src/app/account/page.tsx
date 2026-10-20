import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { staffRoles } from "@/lib/security";
import Logout from "@/components/logout";
export default async function Account() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">YOUR ACCOUNT · {user.role}</div>
      <h1>Hello, {user.name ?? "learner"}.</h1>
      <p className="lead">
        Your account is ready. Resume reviewed practice sessions and see your
        saved results. Purchased products will appear when the storefront
        launches.
      </p>
      <div className="actions">
        <Link className="button" href="/practice">
          Open practice studio
        </Link>
        <Link className="button button-light" href="/practice/history">
          Practice history & reports
        </Link>
        <Link className="button" href="/preview">
          Read the draft lesson
        </Link>
        {staffRoles.includes(user.role) && (
          <Link className="button button-light" href="/admin">
            Open editorial studio
          </Link>
        )}
        <Logout />
      </div>
      <div className="notice">
        No payments are accepted. Registration does not grant paid files or
        premium exam access. Admins may offer free reviewed sessions.
      </div>
    </section>
  );
}
