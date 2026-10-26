// Fixed operator allowlist. Never accept a path or arbitrary lesson filename.
export const editorialPacks = {
  numerical: {
    file: "numerical-foundations.json",
    lessons: ["arithmetic", "fractions", "ratios", "sequences", "word-problems"],
    source: "public-numerical-foundations-v1",
  },
  language: {
    file: "english-foundations.json",
    lessons: ["vocabulary", "grammar", "sentences"],
    source: "public-english-foundations-v1",
  },
  reading: {
    file: "reading-foundations.json",
    lessons: ["paragraphs", "reading"],
    source: "public-reading-foundations-v1",
  },
  tracks: {
    file: "track-foundations.json",
    lessons: ["analogies", "logic", "data", "filing", "spelling"],
    source: "public-track-foundations-v1",
  },
  "practice-core": {
    file: "practice-core.json",
    lessons: ["study-methods", "solutions"],
    source: "public-practice-core-v1",
  },
  "practice-extended": {
    file: "practice-extended.json",
    lessons: ["filipino", "constitution", "ethics", "rights", "environment", "study-plan"],
    source: "public-practice-extended-v1",
  },
} as const;
