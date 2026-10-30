export type TopicResult = {
  topic: string;
  correct: number;
  total: number;
  unanswered: number;
};
export type AttemptView = {
  id: string;
  title: string;
  level: "COMMON" | "PROFESSIONAL" | "SUBPROFESSIONAL";
  series?: { key: string; position: number; unreviewed?: boolean };
  retry?: { sourceAttemptId: string; selection: "missed" | "incorrect" | "unanswered"; sourceTitle: string };
  unreviewed?: boolean;
  mode: "PRACTICE" | "MOCK";
  access: "FREE" | "PREMIUM";
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  serverNow: string;
  revision: number;
  totalQuestions: number;
  score: number | null;
  questions: {
    questionKey: string;
    prompt: string;
    topic: string;
    choices: { label: string; text: string }[];
  }[];
  responses: {
    questionKey: string;
    choiceLabel: string | null;
    flagged: boolean;
  }[];
  result: null | {
    correct: number;
    total: number;
    unanswered: number;
    percent: number;
    byTopic: TopicResult[];
    answers: {
      questionKey: string;
      correctLabel: string;
      selectedLabel: string | null;
      isCorrect: boolean;
      explanation: string;
      sourceNotes: string;
    }[];
  };
};
export type ExamOption = {
  id: string;
  title: string;
  level: string;
  unreviewed?: boolean;
  mode: "PRACTICE" | "MOCK";
  access: "FREE" | "PREMIUM";
  topics: string[];
  questionCount: number;
  durationSeconds: number;
  version: number;
  canStart: boolean;
};
export type AttemptSummary = {
  id: string;
  title: string;
  level: string;
  mode: string;
  status: string;
  startedAt: string;
  deadlineAt: string | null;
  score: number | null;
  totalQuestions: number;
  accessLocked: boolean;
  byTopic: TopicResult[];
};

export type AttemptHistory = {
  attempts: AttemptSummary[];
  byTopic: TopicResult[];
  completedCount: number;
  averagePercent: number | null;
  limit: number;
};
