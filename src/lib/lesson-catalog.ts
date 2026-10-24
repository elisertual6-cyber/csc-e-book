// Public editorial previews only. No assessment question bank is imported here.
export const draftLessons = [
  { slug: "arithmetic", title: "A little order goes a long way", summary: "Translate everyday situations into expressions and check the order of operations." },
  { slug: "fractions", title: "Different forms, the same amount", summary: "Connect fractions, decimals and percentages, including changes from a stated base." },
  { slug: "ratios", title: "Keep the relationship in view", summary: "Use equal ratio parts, proportional reasoning and weighted averages." },
  { slug: "sequences", title: "Look for the rule, then check it", summary: "Compare differences and ratios while recognizing that a short list can fit many rules." },
  { slug: "word-problems", title: "Turn the story into a model", summary: "Track quantities, rates and units before choosing an equation." },
  { slug: "vocabulary", title: "Let the sentence guide the meaning", summary: "Use definitions, examples and contrasts to infer a word's meaning in context." },
  { slug: "grammar", title: "Find the subject before choosing the verb", summary: "Check agreement, time clues, count nouns and sentence completeness in formal English." },
  { slug: "sentences", title: "Connect ideas without losing the structure", summary: "Choose clear connectors, parallel forms and well-joined clauses." },
] as const;

export function findDraftLesson(slug: string) {
  return draftLessons.find(lesson => lesson.slug === slug);
}
