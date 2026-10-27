export const practiceSeriesKey = "five-set-practice-v1";
export const practiceSetCount = 5;
export const practiceSetSize = 160;
const setTopics = ["arithmetic", "fractions", "ratios", "sequences", "word-problems", "data", "vocabulary", "grammar", "sentences", "paragraphs", "reading", "filipino", "analogies", "logic", "filing", "spelling", "constitution", "ethics", "rights", "environment"];
export function questionKeysForSet(position: number) {
  if (!Number.isInteger(position) || position < 1 || position > practiceSetCount) throw new Error("Unknown practice set.");
  const prefix = position === 1 ? "practice160" : `series${position}`;
  return setTopics.flatMap(topic => Array.from({ length: 8 }, (_, index) => `${prefix}-${topic}-${String(index + 1).padStart(2, "0")}`));
}
export type SeriesSettings = {
  seriesKey: string | null; setPosition: number | null; questionKeys: string[];
  level: string; mode: string; access: string; durationSeconds: number; questionCount: number;
};
export function validSeriesSettings(t: SeriesSettings) {
  if (t.seriesKey !== practiceSeriesKey || !Number.isInteger(t.setPosition) ||
    t.setPosition! < 1 || t.setPosition! > practiceSetCount ||
    t.questionKeys.length !== practiceSetSize || new Set(t.questionKeys).size !== practiceSetSize ||
    t.level !== "COMMON" || t.mode !== "PRACTICE" || t.access !== "FREE" ||
    t.durationSeconds !== 0 || t.questionCount !== practiceSetSize) return false;
  const expectedKeys = questionKeysForSet(t.setPosition!);
  return t.questionKeys.every((key, index) => key === expectedKeys[index]);
}
export type SeriesMetadata = { key: string; position: number; unreviewed?: boolean };
export type SeriesCard = {
  position: number; title: string; questionCount: number;
  state: "not_prepared" | "awaiting_review" | "locked" | "available" | "in_progress" | "completed";
  unreviewed: boolean; templateId: string | null; attemptId: string | null; answered: number;
};
export type SeriesProgress = { title: string; totalSets: number; completedSets: number; sets: SeriesCard[] };
