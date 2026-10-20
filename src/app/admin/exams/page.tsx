import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ExamTemplateStudio from "@/components/exam-template-studio";
export default async function Templates() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/account");
  return (
    <section className="shell section page-content">
      <div className="eyebrow">ADMIN · REVIEWED EXAM CONFIGURATION</div>
      <h1>Give practice a purpose.</h1>
      <p className="lead">
        Set track, topic, count, timing and access. Activation requires enough
        independently reviewed published questions.
      </p>
      <p>
        <Link className="text-link" href="/admin">
          ← Editorial studio
        </Link>
      </p>
      <ExamTemplateStudio />
    </section>
  );
}
