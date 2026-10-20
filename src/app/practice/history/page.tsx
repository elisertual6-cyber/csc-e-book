import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ExamHistory from "@/components/exam-history";
export default async function History() {
  if (!(await currentUser())) redirect("/login");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">REFLECT ON YOUR PRACTICE</div>
      <h1>Your progress, honestly measured.</h1>
      <p className="lead">
        Review your saved sessions and subject-level practice results. These are
        not official CSC scores or guarantees.
      </p>
      <ExamHistory />
    </section>
  );
}
