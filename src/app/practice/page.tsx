import PracticeDemo from "@/components/practice-demo";
import ExamLobby from "@/components/exam-lobby";
import { currentUser } from "@/lib/auth";
import Link from "next/link";
export const metadata = { title: "Practice studio" };
export default async function Practice() {
  const user = await currentUser();
  return (
    <section className="shell section page-content">
      <div className="eyebrow">A SPACE TO THINK IT THROUGH</div>
      <h1>
        The practice studio<span className="gold-text">.</span>
      </h1>
      <p className="lead">
        Start small. Focus on the reasoning. Give yourself room to try again.
      </p>
      <div className="notice">
        Topic practice and timed mock sessions use reviewed questions and save
        progress to your account. Counts, timers and results are practice
        settings, not official CSC specifications.
      </div>
      {user ? (
        <ExamLobby />
      ) : (
        <p className="notice">
          <Link className="text-link" href="/login">
            Sign in for reviewed sessions and saved history →
          </Link>{" "}
          The ungraded draft exercise below needs no account.
        </p>
      )}
      <PracticeDemo />
    </section>
  );
}
