import { describe, it, expect } from "vitest";
import { studyRecommendations } from "../src/lib/study-recommendations";
import { reviewerGuides } from "../src/lib/reviewer-catalog";
describe("study recommendations", () => {
  it("prioritizes the lowest recent accuracy, includes unanswered items, and leaves inputs unchanged", () => {
    const topics = [{ topic: "arithmetic", correct: 3, total: 10, unanswered: 2 }, { topic: "reading", correct: 1, total: 5, unanswered: 3 },
      { topic: "logic", correct: 0, total: 0, unanswered: 0 }, { topic: "grammar", correct: 4, total: 4, unanswered: 0 }];
    const copy = structuredClone(topics);
    const result = studyRecommendations(topics);
    expect(result.map(subject => subject.topic)).toEqual(["reading", "arithmetic"]);
    expect(result[0].missed).toBe(4);
    expect(result[0].href).toBe("/reviewers/verbal-ability#reading");
    expect(topics).toEqual(copy);
  });
  it("uses fixed public guide destinations and handles unknown topics without an invented path", () => {
    for (const guide of reviewerGuides) for (const topic of guide.lessons) {
      expect(studyRecommendations([{ topic, correct: 0, total: 2, unanswered: 0 }])[0].href).toBe(`/reviewers/${guide.slug}#${topic}`);
    }
    expect(studyRecommendations([{ topic: "unknown-topic", correct: 0, total: 1, unanswered: 1 }])[0].href).toBe("/reviewers");
    expect(studyRecommendations([])).toEqual([]);
  });
});
