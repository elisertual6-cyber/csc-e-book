import { curriculum } from "./curriculum";
import { reviewerGuides } from "./reviewer-catalog";
import type { TopicResult } from "./exam-types";

export function studyRecommendations(topics: TopicResult[]) {
  return topics.filter(topic => topic.total > 0 && topic.correct < topic.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total || a.topic.localeCompare(b.topic))
    .slice(0, 3).map(topic => {
      const guide = reviewerGuides.find(guide => guide.lessons.some(lesson => lesson === topic.topic));
      return { ...topic, title: curriculum.find(subject => subject.slug === topic.topic)?.title ?? topic.topic,
        missed: topic.total - topic.correct,
        href: guide ? `/reviewers/${guide.slug}#${topic.topic}` : "/reviewers" };
    });
}
