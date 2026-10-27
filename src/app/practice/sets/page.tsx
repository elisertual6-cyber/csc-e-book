import Link from "next/link";
import { currentUser } from "@/lib/auth";
import PracticeSeries from "@/components/practice-series";
export const metadata = { title: "Five practice sets" };
export default async function Sets() {
  const user = await currentUser();
  return <section className="shell section page-content">
    <p className="eyebrow">GUIDED PRACTICE · SAVED TO YOUR ACCOUNT</p>
    <h1>Five sets, one step at a time.</h1>
    <p className="lead">Each set has 160 questions. Answer every question and submit the set to unlock the next one. Your score does not determine access.</p>
    <div className="notice">These mixed-topic sets are untimed practice, not an official CSC examination. Answer keys and explanations appear after submission. Each set requires independently reviewed content before release.</div>
    {user ? <PracticeSeries /> : <p><Link className="button" href="/login">Sign in to view your sets</Link></p>}
    <p><Link className="text-link" href="/practice">← Practice studio</Link></p>
  </section>;
}
