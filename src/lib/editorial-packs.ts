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
  "series-2-core": { file: "series-2-core.json", lessons: [], source: "public-series-2-core-v1" },
  "series-2-extended": { file: "series-2-extended.json", lessons: [], source: "public-series-2-extended-v1" },
  "series-3-core": { file: "series-3-core.json", lessons: [], source: "public-series-3-core-v1" },
  "series-3-extended": { file: "series-3-extended.json", lessons: [], source: "public-series-3-extended-v1" },
  "series-4-core": { file: "series-4-core.json", lessons: [], source: "public-series-4-core-v1" },
  "series-4-extended": { file: "series-4-extended.json", lessons: [], source: "public-series-4-extended-v1" },
  "series-5-core": { file: "series-5-core.json", lessons: [], source: "public-series-5-core-v1" },
  "series-5-extended": { file: "series-5-extended.json", lessons: [], source: "public-series-5-extended-v1" },
} as const;
