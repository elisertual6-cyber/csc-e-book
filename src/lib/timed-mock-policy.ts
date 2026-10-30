import { curriculum } from "./curriculum";
import { questionKeysForSet, type SeriesSettings } from "./practice-series-policy";

export const mockSourceTopic = (key: string) => key.replace(/^(?:practice160|series[2-5])-/, "").replace(/-\d{2}$/, "");

// Practice settings chosen for this app, not an official CSC blueprint.
export const timedMockDefinitions = (["PROFESSIONAL", "SUBPROFESSIONAL"] as const).map(level => {
  const sourceTopics = new Set(questionKeysForSet(1).map(mockSourceTopic));
  const topics = curriculum.filter(t => sourceTopics.has(t.slug) && (t.track === "COMMON" || t.track === level)).map(t => t.slug);
  const keys = [1, 2, 3, 4, 5].flatMap(questionKeysForSet);
  const byTopic = topics.map(topic => keys.filter(key => mockSourceTopic(key) === topic));
  const questionKeys = Array.from({ length: 160 }, (_, index) => byTopic[index % topics.length][Math.floor(index / topics.length)]);
  return {
    slug: `timed-mock-${level.toLowerCase()}-v1`,
    title: `${level === "PROFESSIONAL" ? "Professional" : "Subprofessional"} timed mock — draft practice`,
    level, mode: "MOCK" as const, access: "FREE" as const, topics,
    questionCount: 160, durationSeconds: 9000, questionKeys,
  };
});
export type TimedMockSettings = SeriesSettings & { slug: string; topics: string[] };
export function timedMockDefinition(template: TimedMockSettings) {
  return timedMockDefinitions.find(d => template.slug === d.slug && template.seriesKey === null && template.setPosition === null &&
    template.questionKeys.length === 0 && template.level === d.level && template.mode === d.mode && template.access === d.access &&
    template.questionCount === d.questionCount && template.durationSeconds === d.durationSeconds &&
    JSON.stringify(template.topics) === JSON.stringify(d.topics));
}
