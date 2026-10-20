export type Track = "COMMON" | "PROFESSIONAL" | "SUBPROFESSIONAL";
export const curriculum: {
  slug: string;
  title: string;
  track: Track;
  group: string;
}[] = [
  {
    slug: "study-methods",
    title: "Exam overview and study methods",
    track: "COMMON",
    group: "Start here",
  },
  {
    slug: "vocabulary",
    title: "Vocabulary and context clues",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "grammar",
    title: "English grammar and usage",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "sentences",
    title: "Sentence completion and error recognition",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "paragraphs",
    title: "Paragraph organization",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "reading",
    title: "Reading comprehension",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "filipino",
    title: "Filipino language proficiency",
    track: "COMMON",
    group: "Language",
  },
  {
    slug: "arithmetic",
    title: "Arithmetic and order of operations",
    track: "COMMON",
    group: "Numerical ability",
  },
  {
    slug: "fractions",
    title: "Fractions, decimals, and percentages",
    track: "COMMON",
    group: "Numerical ability",
  },
  {
    slug: "ratios",
    title: "Ratios, averages, and proportions",
    track: "COMMON",
    group: "Numerical ability",
  },
  {
    slug: "sequences",
    title: "Number sequences",
    track: "COMMON",
    group: "Numerical ability",
  },
  {
    slug: "word-problems",
    title: "Mathematical word problems",
    track: "COMMON",
    group: "Numerical ability",
  },
  {
    slug: "analogies",
    title: "Word analogies",
    track: "PROFESSIONAL",
    group: "Analytical track",
  },
  {
    slug: "logic",
    title: "Logical reasoning",
    track: "PROFESSIONAL",
    group: "Analytical track",
  },
  {
    slug: "data",
    title: "Drawing conclusions and data interpretation",
    track: "PROFESSIONAL",
    group: "Analytical track",
  },
  {
    slug: "filing",
    title: "Alphabetical and numerical filing",
    track: "SUBPROFESSIONAL",
    group: "Clerical track",
  },
  {
    slug: "spelling",
    title: "Spelling and clerical accuracy",
    track: "SUBPROFESSIONAL",
    group: "Clerical track",
  },
  {
    slug: "constitution",
    title: "Philippine Constitution",
    track: "COMMON",
    group: "General information",
  },
  {
    slug: "ethics",
    title: "RA 6713 and public service ethics",
    track: "COMMON",
    group: "General information",
  },
  {
    slug: "rights",
    title: "Peace and human rights",
    track: "COMMON",
    group: "General information",
  },
  {
    slug: "environment",
    title: "Environmental management",
    track: "COMMON",
    group: "General information",
  },
  {
    slug: "professional-mock",
    title: "Professional mock examination",
    track: "PROFESSIONAL",
    group: "Practice and planning",
  },
  {
    slug: "subprofessional-mock",
    title: "Subprofessional mock examination",
    track: "SUBPROFESSIONAL",
    group: "Practice and planning",
  },
  {
    slug: "solutions",
    title: "Detailed answers and solutions",
    track: "COMMON",
    group: "Practice and planning",
  },
  {
    slug: "study-plan",
    title: "30-day study plan",
    track: "COMMON",
    group: "Practice and planning",
  },
];
export function chaptersFor(track: Track) {
  return curriculum.filter(
    (chapter) => chapter.track === "COMMON" || chapter.track === track,
  );
}
export const disclaimer =
  "Independent and unofficial. Not affiliated with, endorsed by, or approved by the Civil Service Commission (CSC). No passing guarantee. 2027 exam details remain subject to official verification.";
