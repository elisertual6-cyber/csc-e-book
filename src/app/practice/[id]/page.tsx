import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ExamPlayer from "@/components/exam-player";
export default async function Attempt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await currentUser())) redirect("/login");
  const { id } = await params;
  return (
    <section className="shell section page-content">
      <ExamPlayer id={id} />
    </section>
  );
}
