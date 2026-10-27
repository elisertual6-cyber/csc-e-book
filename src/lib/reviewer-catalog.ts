import { draftLessons } from "./lesson-catalog";
import { curriculum, type Track } from "./curriculum";
type LessonSlug = typeof draftLessons[number]["slug"];
type ReviewerGuide = {
  slug: string; title: string; subtitle: string; summary: string; track: Track;
  lessons: readonly LessonSlug[]; keyIdeas: readonly string[];
};
// Public teaching-guide metadata only. Never import assessment banks here.
export const reviewerGuides = [
  {
    slug: "numerical-ability", title: "Numerical Ability", subtitle: "Make the numbers make sense.", track: "COMMON",
    summary: "Build a reliable method for calculations, percentages, proportions and everyday mathematical problems.",
    lessons: ["arithmetic", "fractions", "ratios", "sequences", "word-problems"],
    keyIdeas: ["Write the quantities and units before calculating.", "Keep the original base when comparing percentage changes.", "Check an answer with substitution, estimation or an inverse operation."],
  },
  {
    slug: "verbal-ability", title: "Verbal Ability", subtitle: "Read closely. Express clearly.", track: "COMMON",
    summary: "Study English and Filipino language skills, then practise following a paragraph’s structure and evidence.",
    lessons: ["vocabulary", "grammar", "sentences", "paragraphs", "reading", "filipino"],
    keyIdeas: ["Use the sentence’s clues before choosing a word’s meaning.", "Find the main subject and verb before checking agreement.", "Support a reading answer with the passage rather than an added assumption."],
  },
  {
    slug: "analytical-ability", title: "Analytical Ability", subtitle: "Follow the relationship and the evidence.", track: "PROFESSIONAL",
    summary: "Work through word relationships, formal premises and labelled data with careful, step-by-step reasoning.",
    lessons: ["analogies", "logic", "data"],
    keyIdeas: ["Name an analogy’s relationship and keep its direction.", "Distinguish a necessary conclusion from a possible one.", "Check the labels, units and denominator in every data comparison."],
  },
  {
    slug: "clerical-ability", title: "Clerical Ability", subtitle: "Build accuracy one detail at a time.", track: "SUBPROFESSIONAL",
    summary: "Practise applying a stated filing rule, checking spelling and preserving every character in a reference.",
    lessons: ["filing", "spelling"],
    keyIdeas: ["Apply the filing rule given in the exercise consistently.", "Compare names and identifiers at the first differing character.", "Preserve leading zeroes, punctuation and character order when copying."],
  },
  {
    slug: "general-information", title: "General Information", subtitle: "Connect principles with their references.", track: "COMMON",
    summary: "Study introductory constitutional, public-service, human-rights and environmental principles with references for further checking.",
    lessons: ["constitution", "ethics", "rights", "environment"],
    keyIdeas: ["Keep the article, section or source instrument beside each principle.", "Distinguish a general statement from a decision about a particular legal case.", "Check current official sources and mark uncertain claims for further study."],
  },
  {
    slug: "study-toolkit", title: "Study Toolkit", subtitle: "Turn a study session into a useful habit.", track: "COMMON",
    summary: "Plan manageable sessions, use proposed keys to reconstruct solutions and revisit the errors that need more work.",
    lessons: ["study-methods", "solutions", "study-plan"],
    keyIdeas: ["Try recalling the method before reading the explanation again.", "Record why an answer went wrong instead of memorising its letter.", "Adapt the study plan to your available time and revisit difficult topics."],
  },
] as const satisfies readonly ReviewerGuide[];
export function findReviewerGuide(slug: string) { return reviewerGuides.find(guide => guide.slug === slug); }
export function reviewerLessonTitle(slug: string) { return curriculum.find(topic => topic.slug === slug)?.title ?? slug; }
export function reviewerTrackLabel(track: Track) {
  return track === "COMMON" ? "Both tracks" : track === "PROFESSIONAL" ? "Professional" : "Subprofessional";
}
