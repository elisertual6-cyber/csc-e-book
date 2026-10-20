import { describe, it, expect } from "vitest";
import { grade, snapshotSchema } from "../src/lib/grading";
const question = {
  questionKey: "one",
  sourceId: "source-1",
  sourceVersion: 1,
  prompt: "What is two plus three?",
  topic: "arithmetic",
  choices: [
    { label: "A", text: "4", isCorrect: false },
    { label: "B", text: "5", isCorrect: true },
    { label: "C", text: "6", isCorrect: false },
    { label: "D", text: "7", isCorrect: false },
  ],
  explanation: "Adding two and three gives five.",
  sourceNotes: "Original synthetic unit-test example.",
};
describe("server-side grading", () => {
  it("scores only saved choices against the immutable snapshot", () => {
    const snapshot = snapshotSchema.parse({
      schemaVersion: 1,
      questions: [
        question,
        { ...question, questionKey: "two", topic: "logic" },
      ],
    });
    const result = grade(snapshot, [
      { questionKey: "one", choiceLabel: "B" },
      { questionKey: "two", choiceLabel: "C" },
      { questionKey: "not-in-this-attempt", choiceLabel: "B" },
    ]);
    expect(result.correct).toBe(1);
    expect(result.total).toBe(2);
    expect(result.percent).toBe(50);
    expect(result.byTopic.find((t) => t.topic === "logic")?.correct).toBe(0);
  });
  it("counts unanswered questions in the denominator", () => {
    const snapshot = snapshotSchema.parse({
      schemaVersion: 1,
      questions: [question, { ...question, questionKey: "two" }],
    });
    const result = grade(snapshot, [{ questionKey: "one", choiceLabel: "B" }]);
    expect(result.unanswered).toBe(1);
    expect(result.correct).toBe(1);
    expect(result.byTopic[0]).toEqual({
      topic: "arithmetic",
      correct: 1,
      total: 2,
      unanswered: 1,
    });
  });
  it("returns zero credit for an entirely unanswered attempt", () => {
    const result = grade(
      snapshotSchema.parse({ schemaVersion: 1, questions: [question] }),
      [],
    );
    expect(result.correct).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.unanswered).toBe(1);
  });
  it("rejects ambiguous answer keys", () => {
    expect(() =>
      snapshotSchema.parse({
        schemaVersion: 1,
        questions: [
          {
            ...question,
            choices: question.choices.map((c) => ({ ...c, isCorrect: true })),
          },
        ],
      }),
    ).toThrow();
  });
  it("rejects duplicate question identifiers and incomplete rationales", () => {
    expect(() =>
      snapshotSchema.parse({
        schemaVersion: 1,
        questions: [question, question],
      }),
    ).toThrow();
    expect(() =>
      snapshotSchema.parse({
        schemaVersion: 1,
        questions: [{ ...question, explanation: "" }],
      }),
    ).toThrow();
  });
});
