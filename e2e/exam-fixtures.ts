import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import {
  expect,
  type PlaywrightWorkerArgs,
  type APIRequestContext,
} from "@playwright/test";
import { hashPassword } from "../src/lib/security";
export async function examFixture(
  playwright: PlaywrightWorkerArgs["playwright"],
) {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const prefix = `exam-${randomUUID().slice(0, 8)}`;
  const origin = "http://127.0.0.1:3100";
  const password = randomUUID() + "-learning";
  const passwordHash = await hashPassword(password);
  const contexts: APIRequestContext[] = [];
  const roles = [
    "ADMIN",
    "REVIEWER",
    "CUSTOMER",
    "CUSTOMER",
    "CUSTOMER",
  ] as const;
  const users = await Promise.all(
    roles.map((role, index) =>
      db.user.create({
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Exam test ${index}`,
          role,
          passwordHash,
        },
      }),
    ),
  );
  async function context(index?: number) {
    const ctx = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin, "X-CSC-Action": "1" },
    });
    contexts.push(ctx);
    if (index !== undefined)
      expect(
        (
          await ctx.post("/api/auth/login", {
            data: { email: users[index].email, password },
          })
        ).status(),
      ).toBe(200);
    return ctx;
  }
  const admin = await context(0),
    reviewer = await context(1),
    alice = await context(2),
    bob = await context(3),
    paid = await context(4),
    anon = await context();
  const numbers = `${prefix}-numbers`,
    logic = `${prefix}-logic`,
    clerical = `${prefix}-clerical`;
  const questionData = (
    key: string,
    topic: string,
    level: string,
    prompt: string,
    correct = "5",
  ) => ({
    key,
    prompt: `${prefix}: ${prompt}`,
    topic,
    level,
    difficulty: "EASY",
    sourceNotes:
      "Synthetic isolated exam-engine test fixture; no substantive human review is represented.",
    explanation: `The independently configured test answer is ${correct}; this explanation belongs only to the synthetic test snapshot.`,
    choices: [
      { label: "A", text: "4", isCorrect: false },
      { label: "B", text: correct, isCorrect: true },
      { label: "C", text: "6", isCorrect: false },
      { label: "D", text: "7", isCorrect: false },
    ],
  });
  async function retryPost(ctx: APIRequestContext, url: string, body: unknown) {
    let response = await ctx.post(url, { data: body });
    for (let retry = 0; response.status() === 409 && retry < 5; retry++) {
      await new Promise((resolve) => setTimeout(resolve, 100 * (retry + 1)));
      response = await ctx.post(url, { data: body });
    }
    return response;
  }
  async function publish(data: ReturnType<typeof questionData>) {
    let r = await retryPost(admin, "/api/admin/questions", {
      action: "create",
      data,
    });
    expect(r.status()).toBe(201);
    let q = await r.json();
    r = await retryPost(admin, "/api/admin/questions", {
      action: "submit",
      id: q.id,
      revision: q.revision,
    });
    expect(r.status()).toBe(200);
    q = await r.json();
    r = await retryPost(reviewer, "/api/admin/questions", {
      action: "approve",
      id: q.id,
      revision: q.revision,
      notes:
        "Simulated independent review solely in a disposable automated-test database.",
      humanReviewed: true,
    });
    expect(r.status()).toBe(200);
    q = await r.json();
    r = await retryPost(admin, "/api/admin/questions", {
      action: "publish",
      id: q.id,
      revision: q.revision,
    });
    expect(r.status()).toBe(200);
    return r.json();
  }
  const bank = [];
  for (const data of [
    questionData(`${prefix}-one`, numbers, "COMMON", "What is two plus three?"),
    questionData(
      `${prefix}-two`,
      numbers,
      "COMMON",
      "What is seven plus four?",
      "11",
    ),
    questionData(
      `${prefix}-logic`,
      logic,
      "PROFESSIONAL",
      "Which value is the logical next value in this synthetic test?",
      "9",
    ),
    questionData(
      `${prefix}-filing`,
      clerical,
      "SUBPROFESSIONAL",
      "Which filing value belongs in this synthetic clerical slot?",
      "8",
    ),
  ])
    bank.push(await publish(data));
  async function template(
    suffix: string,
    options: {
      mode?: string;
      access?: string;
      level?: string;
      topics?: string[];
      questionCount?: number;
      durationSeconds?: number;
    } = {},
  ) {
    const input = {
      slug: `${prefix}-${suffix}`,
      title: `${prefix} ${suffix}`,
      level: "PROFESSIONAL",
      mode: "PRACTICE",
      access: "FREE",
      topics: [numbers],
      questionCount: 2,
      durationSeconds: 0,
      ...options,
    };
    let response = await admin.post("/api/admin/exam-templates", {
      data: { action: "create", data: input },
    });
    expect(response.status()).toBe(200);
    let result = await response.json();
    response = await admin.post("/api/admin/exam-templates", {
      data: { action: "activate", id: result.id, version: result.version },
    });
    expect(response.status()).toBe(200);
    result = await response.json();
    return result;
  }
  return {
    db,
    prefix,
    origin,
    users,
    contexts,
    context,
    admin,
    reviewer,
    alice,
    bob,
    paid,
    anon,
    numbers,
    logic,
    clerical,
    bank,
    questionData,
    publish,
    template,
    async dispose() {
      for (const ctx of contexts) await ctx.dispose();
      await db.$disconnect();
    },
  };
}
