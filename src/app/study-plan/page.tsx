import Link from "next/link";
import StudyPlanner from "@/components/study-planner";

export const metadata = { title: "30-day study planner", description: "A personal, ungraded schedule for the available draft lessons, with review and catch-up days." };
export default function StudyPlan() {
  return (
    <section className="shell section page-content planner-page">
      <div className="eyebrow">A LITTLE STRUCTURE FOR YOUR NEXT STEP</div>
      <h1>Your 30-day study plan.</h1>
      <p className="lead">Choose your track, set aside a manageable amount of time and return to difficult ideas. Build a routine that fits your life.</p>
      <div className="notice">An optional schedule for the available draft lessons, not a complete curriculum or official CSC timetable. The lessons await independent review. Take more time or rest when needed; 30 days is a planning choice, not a passing guarantee.</div>
      <StudyPlanner />
      <p className="planner-help"><Link className="text-link" href="/reviewers">Browse the subject reviewers →</Link></p>
    </section>
  );
}
