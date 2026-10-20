import PracticeDemo from "@/components/practice-demo";
export const metadata = { title: "Practice studio" };
export default function Practice() {
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
        Foundation demo · Full topic practice, timed exams and saved history are
        not yet available.
      </div>
      <PracticeDemo />
    </section>
  );
}
