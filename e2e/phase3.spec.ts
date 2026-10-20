import { test, expect, type APIResponse } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { examFixture } from "./exam-fixtures";
function keys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => [key, ...keys(v)]);
}
async function body(response: APIResponse, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return response.json();
}
test("server-owned attempts, timing, immutable grades, ownership and paid access", async ({
  playwright,
}) => {
  test.setTimeout(120000);
  const f = await examFixture(playwright);
  try {
    const { admin, alice, bob, paid, anon, db } = f;
    expect((await anon.get("/api/exams/templates")).status()).toBe(401);
    expect((await bob.get("/api/admin/exam-templates")).status()).toBe(403);
    const practice = await f.template("practice");
    const premium = await f.template("premium", {
      mode: "MOCK",
      access: "PREMIUM",
      topics: [f.numbers, f.logic],
      questionCount: 3,
      durationSeconds: 60,
    });
    const timed = await f.template("timed", {
      mode: "MOCK",
      durationSeconds: 60,
    });
    const unreviewed = await body(
      await admin.post("/api/admin/exam-templates", {
        data: {
          action: "create",
          data: {
            slug: `${f.prefix}-draft-template`,
            title: "Draft bank must not activate",
            level: "PROFESSIONAL",
            mode: "PRACTICE",
            access: "FREE",
            topics: [`${f.prefix}-unreviewed`],
            questionCount: 1,
            durationSeconds: 0,
          },
        },
      }),
    );
    await body(
      await admin.post("/api/admin/questions", {
        data: {
          action: "create",
          data: f.questionData(
            `${f.prefix}-draft`,
            `${f.prefix}-unreviewed`,
            "COMMON",
            "This draft must never enter an exam attempt.",
          ),
        },
      }),
      201,
    );
    expect(
      (
        await admin.post("/api/admin/exam-templates", {
          data: {
            action: "activate",
            id: unreviewed.id,
            version: unreviewed.version,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await alice.post("/api/exams/attempts", {
          data: {
            templateId: practice.id,
            startKey: randomUUID(),
            score: 999,
            deadlineAt: "2099-01-01",
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await alice.post("/api/exams/attempts", {
          data: {
            templateId: practice.id,
            startKey: randomUUID(),
            topic: f.clerical,
          },
        })
      ).status(),
    ).toBe(400);
    const start = { templateId: practice.id, startKey: randomUUID() };
    const starts = await Promise.all([
      alice.post("/api/exams/attempts", { data: start }),
      alice.post("/api/exams/attempts", { data: start }),
    ]);
    const first = await body(starts[0], 201),
      again = await body(starts[1], 201);
    expect(again.id).toBe(first.id);
    expect(
      await db.attempt.count({
        where: { userId: f.users[2].id, startKey: start.startKey },
      }),
    ).toBe(1);
    expect(
      (
        await alice.post("/api/exams/attempts", {
          data: { ...start, questionCount: 1 },
        })
      ).status(),
    ).toBe(409);
    for (const key of [
      "isCorrect",
      "correctLabel",
      "explanation",
      "sourceNotes",
      "questionSnapshot",
      "templateSnapshot",
      "sourceId",
    ])
      expect(keys(first)).not.toContain(key);
    expect(first.result).toBeNull();
    expect(first.score).toBeNull();
    expect(first.deadlineAt).toBeNull();
    expect((await bob.get(`/api/exams/attempts/${first.id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await bob.post(`/api/exams/attempts/${first.id}`, {
          data: { action: "submit" },
        })
      ).status(),
    ).toBe(404);
    const key = first.questions[0].questionKey;
    const answer = { questionKey: key, choiceLabel: "B", flagged: false };
    expect(
      (
        await alice.patch(`/api/exams/attempts/${first.id}`, {
          data: {
            revision: 0,
            responses: [answer, { ...answer, questionKey: "foreign-question" }],
          },
        })
      ).status(),
    ).toBe(400);
    expect(await db.response.count({ where: { attemptId: first.id } })).toBe(0);
    const writes = await Promise.all([
      alice.patch(`/api/exams/attempts/${first.id}`, {
        data: { revision: 0, responses: [answer] },
      }),
      alice.patch(`/api/exams/attempts/${first.id}`, {
        data: { revision: 0, responses: [{ ...answer, flagged: true }] },
      }),
    ]);
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 409]);
    let saved = await body(await alice.get(`/api/exams/attempts/${first.id}`));
    saved = await body(
      await alice.patch(`/api/exams/attempts/${first.id}`, {
        data: {
          revision: saved.revision,
          responses: [{ ...answer, flagged: true }],
        },
      }),
    );
    expect(saved.responses[0].flagged).toBe(true);
    expect(saved.result).toBeNull();
    expect(keys(saved)).not.toContain("isCorrect");
    // New bank publication cannot change an already-started attempt's answers.
    await f.publish({
      ...f.questionData(
        `${f.prefix}-one`,
        f.numbers,
        "COMMON",
        "A revised version asks three plus three.",
        "5",
      ),
      choices: [
        { label: "A", text: "4", isCorrect: false },
        { label: "B", text: "5", isCorrect: false },
        { label: "C", text: "6", isCorrect: true },
        { label: "D", text: "7", isCorrect: false },
      ],
      explanation:
        "This new version has answer C, but prior attempts retain their own original version.",
    });
    expect(
      (
        await alice.post(`/api/exams/attempts/${first.id}`, {
          data: { action: "submit", score: 2 },
        })
      ).status(),
    ).toBe(400);
    const submits = await Promise.all([
      alice.post(`/api/exams/attempts/${first.id}`, {
        data: { action: "submit" },
      }),
      alice.post(`/api/exams/attempts/${first.id}`, {
        data: { action: "submit" },
      }),
    ]);
    const result = await body(submits[0]),
      duplicate = await body(submits[1]);
    expect(result.status).toBe("SUBMITTED");
    expect(result.score).toBe(1);
    expect(result.result.unanswered).toBe(1);
    expect(result.result.percent).toBe(50);
    expect(
      result.result.answers.every(
        (answer: { correctLabel: string }) => answer.correctLabel === "B",
      ),
    ).toBe(true);
    expect(duplicate.result).toEqual(result.result);
    expect(duplicate.submittedAt).toBe(result.submittedAt);
    expect(
      await db.auditEvent.count({
        where: { targetId: first.id, action: "exam.submit" },
      }),
    ).toBe(1);
    expect(
      (
        await alice.patch(`/api/exams/attempts/${first.id}`, {
          data: { revision: result.revision, responses: [answer] },
        })
      ).status(),
    ).toBe(409);
    // The database deadline wins over a late answer and an invented client Date header.
    const expiring = await body(
      await alice.post("/api/exams/attempts", {
        data: { templateId: timed.id, startKey: randomUUID() },
      }),
      201,
    );
    const serverSnapshot = (
      await db.attempt.findUniqueOrThrow({ where: { id: expiring.id } })
    ).questionSnapshot as unknown as {
      questions: {
        questionKey: string;
        choices: { label: string; isCorrect: boolean }[];
      }[];
    };
    const e1 = serverSnapshot.questions[0],
      e2 = serverSnapshot.questions[1];
    let e = await body(
      await alice.patch(`/api/exams/attempts/${expiring.id}`, {
        data: {
          revision: 0,
          responses: [
            {
              questionKey: e1.questionKey,
              choiceLabel: e1.choices.find((c) => c.isCorrect)!.label,
              flagged: false,
            },
          ],
        },
      }),
    );
    await db.attempt.update({
      where: { id: expiring.id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    e = await body(
      await alice.patch(`/api/exams/attempts/${expiring.id}`, {
        headers: { Date: "Sat, 01 Jan 2000 00:00:00 GMT" },
        data: {
          revision: e.revision,
          responses: [
            {
              questionKey: e2.questionKey,
              choiceLabel: e2.choices.find((c) => c.isCorrect)!.label,
              flagged: false,
            },
          ],
        },
      }),
    );
    expect(e.status).toBe("EXPIRED");
    expect(e.score).toBe(1);
    expect(e.responses).toHaveLength(1);
    expect(
      (
        await body(
          await alice.post(`/api/exams/attempts/${expiring.id}`, {
            data: { action: "submit" },
          }),
        )
      ).score,
    ).toBe(1);
    // Access depends on a paid, verified, matching, non-mock order and live entitlement.
    const paidStart = { templateId: premium.id, startKey: randomUUID() };
    expect(
      (await paid.post("/api/exams/attempts", { data: paidStart })).status(),
    ).toBe(403);
    const product = await db.product.create({
      data: {
        slug: `${f.prefix}-premium-access`,
        name: "Isolated exam access",
        description: "Synthetic purchase fixture",
        version: "test",
        grantsExams: true,
      },
    });
    const order = await db.order.create({
      data: {
        userId: f.users[4].id,
        status: "PAID",
        totalMinor: 39900,
        currency: "PHP",
      },
    });
    const price = await db.price.create({
      data: { productId: product.id, amountMinor: 39900, currency: "PHP" },
    });
    const orderItem = await db.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        priceId: price.id,
        unitPriceMinor: 39900,
      },
    });
    const entitlement = await db.entitlement.create({
      data: { userId: f.users[4].id, orderId: order.id, productId: product.id },
    });
    expect(
      (await paid.post("/api/exams/attempts", { data: paidStart })).status(),
    ).toBe(403);
    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "mock",
        providerEventId: randomUUID(),
        status: "VERIFIED",
        verifiedAt: new Date(),
        amountMinor: 39900,
        currency: "PHP",
      },
    });
    expect(
      (await paid.post("/api/exams/attempts", { data: paidStart })).status(),
    ).toBe(403);
    await db.payment.update({
      where: { id: payment.id },
      data: { provider: "isolated-sandbox", currency: "USD" },
    });
    expect(
      (await paid.post("/api/exams/attempts", { data: paidStart })).status(),
    ).toBe(403);
    await db.payment.update({
      where: { id: payment.id },
      data: { currency: "PHP" },
    });
    const premiumAttempt = await body(
      await paid.post("/api/exams/attempts", { data: paidStart }),
      201,
    );
    expect(premiumAttempt.questions).toHaveLength(3);
    await db.orderItem.update({
      where: { id: orderItem.id },
      data: { unitPriceMinor: 100 },
    });
    expect(
      (await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)).status(),
    ).toBe(403);
    await db.orderItem.update({
      where: { id: orderItem.id },
      data: { unitPriceMinor: 39900 },
    });
    expect(
      premiumAttempt.questions.some(
        (q: { topic: string }) => q.topic === f.clerical,
      ),
    ).toBe(false);
    expect(
      (
        await paid.post("/api/exams/attempts", {
          data: {
            templateId: premium.id,
            startKey: randomUUID(),
            questionCount: 1,
          },
        })
      ).status(),
    ).toBe(400);
    await db.entitlement.update({
      where: { id: entitlement.id },
      data: { revokedAt: new Date() },
    });
    expect(
      (await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)).status(),
    ).toBe(403);
    expect(
      (
        await paid.post(`/api/exams/attempts/${premiumAttempt.id}`, {
          data: { action: "submit" },
        })
      ).status(),
    ).toBe(403);
    await db.entitlement.update({
      where: { id: entitlement.id },
      data: { revokedAt: null, expiresAt: new Date(0) },
    });
    expect(
      (await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)).status(),
    ).toBe(403);
    await db.entitlement.update({
      where: { id: entitlement.id },
      data: { expiresAt: null },
    });
    await db.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED" },
    });
    expect(
      (await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)).status(),
    ).toBe(403);
    await db.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    expect(
      (await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)).status(),
    ).toBe(200);
    // Historical metadata is frozen when the template changes/deactivates.
    await body(
      await admin.post("/api/admin/exam-templates", {
        data: {
          action: "save",
          id: premium.id,
          version: premium.version,
          data: {
            slug: premium.slug,
            title: "A later template title",
            level: "PROFESSIONAL",
            mode: "MOCK",
            access: "PREMIUM",
            topics: [f.numbers],
            questionCount: 1,
            durationSeconds: 120,
          },
        },
      }),
    );
    expect(
      (await body(await paid.get(`/api/exams/attempts/${premiumAttempt.id}`)))
        .title,
    ).toBe(premium.title);
    const history = await body(await alice.get("/api/exams/history"));
    expect(history.completedCount).toBe(2);
    expect(history.byTopic[0].total).toBe(4);
    expect(history.averagePercent).toBe(50);
    expect(keys(history)).not.toContain("explanation");
    expect(
      (await body(await bob.get("/api/exams/history"))).attempts,
    ).toHaveLength(0);
    const quotaStarts = await Promise.all(
      Array.from({ length: 4 }, () =>
        alice.post("/api/exams/attempts", {
          data: {
            templateId: practice.id,
            startKey: randomUUID(),
            questionCount: 1,
          },
        }),
      ),
    );
    expect(quotaStarts.map((r) => r.status()).sort()).toEqual([
      201, 201, 201, 409,
    ]);
    expect(
      (await body(await alice.get("/api/exams/history"))).attempts.filter(
        (a: { status: string }) => a.status === "IN_PROGRESS",
      ),
    ).toHaveLength(3);
  } finally {
    await f.dispose();
  }
});
