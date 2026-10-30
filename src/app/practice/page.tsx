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
        Sessions save progress to your account. Timed draft mocks are labelled
        unreviewed; other sessions require reviewed questions. Counts, timers and results are practice
        settings, not official CSC specifications.
      </div>
      <p><Link className="button" href="/practice/sets">Open the five 160-question sets →</Link></p>
      {user ? (
        <ExamLobby />
      ) : (
        <p className="notice">
          <Link className="text-link" href="/login">
            Sign in for practice sessions and saved history →
          </Link>{" "}
          The ungraded draft exercise below needs no account.
        </p>
      )}
      <PracticeDemo />
    </section>
  );
}
