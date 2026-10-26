// Operator/test export helper only. Never import assessment packs in public readers.
import type { validateDraftPack } from "./draft-pack";
type Question = ReturnType<typeof validateDraftPack>["questions"][number];
export function practiceReviewDocuments(questions: Question[]) {
  const heading = "Original 160-question practice expansion — DRAFT";
  const note = "Independent correctness, originality, source and language review pending. Unofficial educational samples, not a released examination or a passing guarantee. Questions and proposed keys are public-source drafts.";
  const booklet = [`# ${heading}`, note, "Choose one option per item. Use the separate proposed answer key after attempting the questions."];
  const key = [`# Proposed answer key — ${heading}`, note];
  const csv = [["Number", "Item key", "Topic", "Track", "Answer", "Answer text", "Explanation"]];
  questions.forEach((q, index) => {
    const answer = q.choices.find(c => c.isCorrect);
    if (!answer || q.choices.filter(c => c.isCorrect).length !== 1) throw new Error("A single proposed key is required.");
    booklet.push(`## ${index + 1}. ${q.topic} (${q.level})`, `Item: ${q.key} · Version ${q.version}`, q.prompt,
      q.choices.map(c => `${c.label}. ${c.text}`).join("\n\n"));
    key.push(`## ${index + 1}. ${answer.label} — ${answer.text}`, `Item: ${q.key} · ${q.topic} · ${q.level}`, q.explanation);
    csv.push([String(index + 1), q.key, q.topic, q.level, answer.label, answer.text, q.explanation]);
  });
  return {
    questions: booklet.join("\n\n") + "\n",
    answers: key.join("\n\n") + "\n",
    csv: csv.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n",
  };
}
