// Fixed public teaching metadata. Assessment packs are never loaded here.
export const reviewerSupplements = [
  { guide: "numerical-ability", title: "Keep the base and the units visible", file: "numerical-steps.md" },
  { guide: "verbal-ability", title: "Separate the sentence from your assumptions", file: "verbal-evidence.md" },
  { guide: "analytical-ability", title: "Test a conclusion before accepting it", file: "analytical-checks.md" },
  { guide: "clerical-ability", title: "Use two passes for names and identifiers", file: "clerical-checks.md" },
  { guide: "general-information", title: "Apply the stated rule and limit the claim", file: "service-scenarios.md" },
  { guide: "study-toolkit", title: "Turn a result into your next study session", file: "next-session.md" },
] as const;
export function findReviewerSupplement(guide: string) { return reviewerSupplements.find(lesson => lesson.guide === guide); }
