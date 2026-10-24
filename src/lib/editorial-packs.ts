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
} as const;
