// Public editorial previews only. No assessment question bank is imported here.
export const draftLessons = [
  { track: "COMMON", slug: "arithmetic", title: "A little order goes a long way", summary: "Translate everyday situations into expressions and check the order of operations." },
  { track: "COMMON", slug: "fractions", title: "Different forms, the same amount", summary: "Connect fractions, decimals and percentages, including changes from a stated base." },
  { track: "COMMON", slug: "ratios", title: "Keep the relationship in view", summary: "Use equal ratio parts, proportional reasoning and weighted averages." },
  { track: "COMMON", slug: "sequences", title: "Look for the rule, then check it", summary: "Compare differences and ratios while recognizing that a short list can fit many rules." },
  { track: "COMMON", slug: "word-problems", title: "Turn the story into a model", summary: "Track quantities, rates and units before choosing an equation." },
  { track: "COMMON", slug: "vocabulary", title: "Let the sentence guide the meaning", summary: "Use definitions, examples and contrasts to infer a word's meaning in context." },
  { track: "COMMON", slug: "grammar", title: "Find the subject before choosing the verb", summary: "Check agreement, time clues, count nouns and sentence completeness in formal English." },
  { track: "COMMON", slug: "sentences", title: "Connect ideas without losing the structure", summary: "Choose clear connectors, parallel forms and well-joined clauses." },
  { track: "COMMON", slug: "paragraphs", title: "Give each sentence a clear place", summary: "Follow controlling ideas, action sequences and references to organize a paragraph." },
  { track: "COMMON", slug: "reading", title: "Support the answer with the passage", summary: "Separate stated details from inferences and preserve the passage's limits." },
  { track: "PROFESSIONAL", slug: "analogies", title: "Name the relationship before matching the words", summary: "Match a precise relationship while preserving its direction." },
  { track: "PROFESSIONAL", slug: "logic", title: "Follow what the premises actually allow", summary: "Check implications, quantifiers and ordering without adding assumptions." },
  { track: "PROFESSIONAL", slug: "data", title: "Read the labels before calculating", summary: "Use units and denominators to interpret invented tables carefully." },
  { track: "SUBPROFESSIONAL", slug: "filing", title: "Apply the stated filing rule consistently", summary: "Order declared keys and numeric suffixes without changing source identifiers." },
  { track: "SUBPROFESSIONAL", slug: "spelling", title: "Compare carefully instead of guessing from appearance", summary: "Check conventional spelling and exact transcription as different tasks." },
  {"track": "COMMON", "slug": "study-methods", "title": "Practise a method, then examine the evidence", "summary": "Build a repeatable routine using retrieval, explanation and an error log."},
  {"track": "COMMON", "slug": "filipino", "title": "Iugnay ang salita sa gamit at konteksto", "summary": "Unawain ang pananda, pang-ugnay at pahiwatig ng kahulugan sa Filipino."},
  {"track": "COMMON", "slug": "constitution", "title": "Read constitutional principles with their article references", "summary": "Locate basic constitutional allocations and rights without inventing case-specific rules."},
  {"track": "COMMON", "slug": "ethics", "title": "Connect public-service choices with the stated norm", "summary": "Use RA 6713 as a referenced starting point for public-interest and accountability exercises."},
  {"track": "COMMON", "slug": "rights", "title": "Identify a rights principle without overstating it", "summary": "Read selected UDHR principles while distinguishing their text from local case-specific law."},
  {"track": "COMMON", "slug": "environment", "title": "Prevent waste and compare environmental claims carefully", "summary": "Distinguish reduction, reuse, appropriate recovery and evidence-based resource comparisons."},
  {"track": "COMMON", "slug": "solutions", "title": "Use the key to reconstruct a solution", "summary": "Check the reasoning behind a proposed answer rather than memorising letters."},
  {"track": "COMMON", "slug": "study-plan", "title": "Plan review sessions with room to revise", "summary": "Build a flexible 30-day practice plan from your available time and error log."},
] as const;

export function findDraftLesson(slug: string) {
  return draftLessons.find(lesson => lesson.slug === slug);
}
