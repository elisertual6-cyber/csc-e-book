import "dotenv/config";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { hashPassword, digest } from "../src/lib/security";
// Concurrent fixture writers may receive PostgreSQL serialization conflicts.
// Retry only the generic transaction-conflict response for otherwise valid writes.
async function transactionWrite(
  ctx: APIRequestContext,
  url: string,
  options: NonNullable<Parameters<APIRequestContext["post"]>[1]>,
) {
  let response = await ctx.post(url, options);
  for (let retry = 0; retry < 5 && response.status() === 409; retry++) {
    if (
      (await response.json()).error !==
      "The record conflicts with another change. Refresh and try again."
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 100 * (retry + 1)));
    response = await ctx.post(url, options);
  }
  return response;
}
test("role boundaries, independent review, atomic import and protected PDF publication", async ({
  playwright,
  browser,
}) => {
  test.setTimeout(120_000);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const base = "http://127.0.0.1:3100";
  const prefix = `test-${randomUUID().slice(0, 8)}`;
  const password = randomUUID() + "-secure";
  const passwordHash = await hashPassword(password);
  const users = await Promise.all(
    (["ADMIN", "REVIEWER", "EDITOR", "CUSTOMER"] as const).map((role) =>
      db.user.create({
        data: {
          email: `${prefix}-${role.toLowerCase()}@example.test`,
          name: `Test ${role}`,
          role,
          passwordHash,
        },
      }),
    ),
  );
  const contexts: APIRequestContext[] = [];
  const anon = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { Origin: base, "X-CSC-Action": "1" },
  });
  contexts.push(anon);
  async function signIn(index: number) {
    const ctx = await playwright.request.newContext({
      baseURL: base,
      extraHTTPHeaders: { Origin: base, "X-CSC-Action": "1" },
    });
    contexts.push(ctx);
    const response = await ctx.post("/api/auth/login", {
      data: { email: users[index].email, password },
    });
    expect(response.status()).toBe(200);
    return ctx;
  }
  try {
    const admin = await signIn(0),
      reviewer = await signIn(1),
      editor = await signIn(2),
      customer = await signIn(3);
    const state = await customer.storageState();
    const cookie = state.cookies.find((c) => c.name === "__Host-csc_session")!;
    expect(!!cookie).toBe(true);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    const session = await db.session.findFirstOrThrow({
      where: { userId: users[3].id },
    });
    expect(session.tokenHash === digest(cookie.value)).toBe(true);
    expect(session.tokenHash === cookie.value).toBe(false);
    expect((await anon.get("/api/admin/questions")).status()).toBe(401);
    expect((await customer.get("/api/admin/questions")).status()).toBe(403);
    expect(
      (
        await customer.post("/api/admin/lessons", {
          data: { action: "create", data: {} },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await anon.post("/api/auth/register", {
          data: {
            email: `${prefix}-escalate@example.test`,
            password,
            name: "No escalation",
            role: "ADMIN",
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await anon.post("/api/auth/login", {
          headers: { Origin: "https://evil.example" },
          data: { email: users[0].email, password },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await anon.post("/api/auth/login", {
          data: { email: users[0].email, password: randomUUID() },
        })
      ).status(),
    ).toBe(401);
    // Expired sessions fail closed; logout also revokes a replayed cookie.
    await db.session.updateMany({
      where: { userId: users[3].id },
      data: { expiresAt: new Date(0) },
    });
    expect((await customer.get("/api/admin/questions")).status()).toBe(401);
    const freshCustomer = await signIn(3);
    const replay = (await freshCustomer.storageState()).cookies.find(
      (c) => c.name === "__Host-csc_session",
    )!;
    expect(
      (await freshCustomer.post("/api/auth/logout", { data: {} })).status(),
    ).toBe(200);
    expect(
      (
        await anon.get("/api/admin/questions", {
          headers: { Cookie: `__Host-csc_session=${replay.value}` },
        })
      ).status(),
    ).toBe(401);
    const chapterCreated = await admin.post("/api/admin/chapters", {
      data: {
        action: "create",
        data: {
          slug: `${prefix}-chapter`,
          title: "Isolated test chapter",
          position: 900,
          level: "COMMON",
        },
      },
    });
    expect(chapterCreated.status()).toBe(200);
    const chapter = await chapterCreated.json();
    expect(
      (
        await admin.post("/api/admin/chapters", {
          data: {
            action: "save",
            id: chapter.id,
            data: {
              slug: `${prefix}-chapter`,
              title: "Isolated revised chapter",
              position: 901,
              level: "COMMON",
            },
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await reviewer.post("/api/admin/chapters", {
          data: { action: "delete", id: chapter.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.post("/api/admin/chapters", {
          data: { action: "delete", id: chapter.id },
        })
      ).status(),
    ).toBe(200);
    const limitedEmail = `${prefix}-limits@example.test`;
    for (let i = 0; i < 8; i++)
      expect(
        (
          await anon.post("/api/auth/login", {
            data: { email: limitedEmail, password },
          })
        ).status(),
      ).toBe(401);
    expect(
      (
        await anon.post("/api/auth/login", {
          data: { email: limitedEmail, password },
        })
      ).status(),
    ).toBe(429);
    const cliEmail = `${prefix}-operator@example.test`;
    const createdOutput = execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/create-user.ts",
        "--email",
        cliEmail,
        "--role",
        "CUSTOMER",
      ],
      { input: password + "\n", encoding: "utf8", env: process.env },
    );
    expect(createdOutput).toContain("Account created");
    const operatorContext = await playwright.request.newContext({
      baseURL: base,
      extraHTTPHeaders: { Origin: base, "X-CSC-Action": "1" },
    });
    contexts.push(operatorContext);
    expect(
      (
        await operatorContext.post("/api/auth/login", {
          data: { email: cliEmail, password },
        })
      ).status(),
    ).toBe(200);
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/set-role.ts",
        "--email",
        cliEmail,
        "--role",
        "REVIEWER",
      ],
      { env: process.env },
    );
    expect((await operatorContext.get("/api/admin/questions")).status()).toBe(
      401,
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { email: cliEmail } })).role,
    ).toBe("REVIEWER");
    const markdown =
      (await readFile("content/lessons/arithmetic.md", "utf8")) +
      "\n\n## Filipino na halimbawa\n\nAng pag-aaral ay isang hakbang patungo sa paglilingkod.\n";
    const lessonData = {
      slug: `${prefix}-lesson`,
      title: "Isolated test arithmetic lesson",
      chapterSlug: "arithmetic",
      objectives: ["Apply the order of operations and check units."],
      markdown,
    };
    const lessonResponse = await admin.post("/api/admin/lessons", {
      data: { action: "create", data: lessonData },
    });
    expect(lessonResponse.status()).toBe(201);
    let lesson = await lessonResponse.json();
    const qData = {
      key: `${prefix}-question`,
      prompt:
        "Isolated test: What is the total of four groups of three objects?",
      topic: "arithmetic",
      level: "COMMON",
      difficulty: "EASY",
      sourceNotes:
        "Synthetic automated-test fixture in an isolated disposable database. Not human-reviewed educational material.",
      explanation:
        "Four groups of three objects contain twelve objects because 4 multiplied by 3 equals 12.",
      choices: [
        { label: "A", text: "7", isCorrect: false },
        { label: "B", text: "12", isCorrect: true },
        { label: "C", text: "16", isCorrect: false },
        { label: "D", text: "24", isCorrect: false },
      ],
    };
    const qResponse = await transactionWrite(admin, "/api/admin/questions", {
      data: { action: "create", data: qData },
    });
    expect(qResponse.status()).toBe(201);
    let question = await qResponse.json();
    const saved = await transactionWrite(admin, "/api/admin/questions", {
      data: {
        action: "save",
        id: question.id,
        revision: question.revision,
        data: qData,
      },
    });
    expect(saved.status()).toBe(200);
    question = await saved.json();
    expect(
      (
        await admin.post("/api/admin/questions", {
          data: { action: "save", id: question.id, revision: 1, data: qData },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await reviewer.post("/api/admin/questions", {
          data: {
            action: "save",
            id: question.id,
            revision: question.revision,
            data: qData,
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.post("/api/admin/lessons", {
          data: { action: "publish", id: lesson.id, revision: lesson.revision },
        })
      ).status(),
    ).toBe(409);
    const csv = await admin.get("/api/admin/questions/transfer?format=csv");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain("correctLabel");
    const ownQuestions = { key: { startsWith: prefix } };
    const before = await db.question.count({ where: ownQuestions });
    const invalid = {
      ...qData,
      key: `${prefix}-bad`,
      choices: qData.choices.map((c) => ({ ...c, isCorrect: true })),
    };
    expect(
      (
        await transactionWrite(admin, "/api/admin/questions/transfer", {
          data: {
            format: "json",
            data: JSON.stringify([
              {
                ...qData,
                key: `${prefix}-import`,
                prompt:
                  "Isolated import: Calculate three groups of five counters.",
              },
              invalid,
            ]),
          },
        })
      ).status(),
    ).toBe(400);
    expect(await db.question.count({ where: ownQuestions })).toBe(before);
    const imported = await transactionWrite(
      admin,
      "/api/admin/questions/transfer",
      {
        data: {
          format: "json",
          data: JSON.stringify([
            {
              ...qData,
              key: `${prefix}-import`,
              prompt:
                "Isolated import: Calculate three groups of five counters.",
            },
          ]),
        },
      },
    );
    expect(imported.status()).toBe(201);
    expect(
      await db.question.count({
        where: { key: `${prefix}-import`, status: "DRAFT" },
      }),
    ).toBe(1);
    const csvImport = stringify(
      [
        {
          key: `${prefix}-csv`,
          prompt: "Isolated CSV: What is the sum of ten and five counters?",
          topic: "arithmetic",
          level: "COMMON",
          difficulty: "EASY",
          sourceNotes: qData.sourceNotes,
          explanation:
            "Ten counters plus five counters gives fifteen counters by addition.",
          optionA: "10",
          optionB: "15",
          optionC: "20",
          optionD: "25",
          correctLabel: "B",
        },
      ],
      { header: true },
    );
    expect(
      (
        await transactionWrite(admin, "/api/admin/questions/transfer", {
          data: { format: "csv", data: csvImport },
        })
      ).status(),
    ).toBe(201);
    const activeCustomer = await signIn(3);
    const draft = await editor.post("/api/admin/pdf", {
      data: {
        kind: "DRAFT",
        version: "test-draft",
        title: "Isolated editorial proof",
        lessonIds: [lesson.id],
        questionIds: [question.id],
      },
    });
    expect(draft.status()).toBe(201);
    const draftId = (await draft.json()).id;
    expect((await anon.get(`/api/admin/pdf/${draftId}`)).status()).toBe(401);
    expect(
      (await activeCustomer.get(`/api/admin/pdf/${draftId}`)).status(),
    ).toBe(403);
    expect((await anon.get("/api/preview.pdf")).status()).toBe(404);
    for (const resource of ["lessons", "questions"] as const) {
      let record = resource === "lessons" ? lesson : question;
      const submitted = await admin.post(`/api/admin/${resource}`, {
        data: { action: "submit", id: record.id, revision: record.revision },
      });
      expect(submitted.status()).toBe(200);
      record = await submitted.json();
      expect(
        (
          await admin.post(`/api/admin/${resource}`, {
            data: {
              action: "approve",
              id: record.id,
              revision: record.revision,
              notes:
                "Simulated test-only attestation; not actual content review.",
              humanReviewed: true,
            },
          })
        ).status(),
      ).toBe(403);
      const approved = await reviewer.post(`/api/admin/${resource}`, {
        data: {
          action: "approve",
          id: record.id,
          revision: record.revision,
          notes:
            "Simulated test-only independent approval in isolated database.",
          humanReviewed: true,
        },
      });
      expect(approved.status()).toBe(200);
      record = await approved.json();
      expect(
        (
          await admin.post(`/api/admin/${resource}`, {
            data: { action: "publish", id: record.id, revision: 1 },
          })
        ).status(),
      ).toBe(409);
      const released = await admin.post(`/api/admin/${resource}`, {
        data: { action: "publish", id: record.id, revision: record.revision },
      });
      expect(released.status()).toBe(200);
      record = await released.json();
      if (resource === "lessons") lesson = record;
      else question = record;
    }
    expect(
      (
        await admin.post("/api/admin/questions", {
          data: {
            action: "save",
            id: question.id,
            revision: question.revision,
            data: {
              ...qData,
              prompt: "An attempted rewrite of a published immutable question",
            },
          },
        })
      ).status(),
    ).toBe(409);
    const full = await admin.post("/api/admin/pdf", {
      data: {
        kind: "FULL",
        version: "test-full",
        title: "Isolated full gate test",
        lessonIds: [lesson.id],
        questionIds: [question.id],
      },
    });
    expect(full.status()).toBe(409);
    expect((await full.json()).error).toContain("500");
    const generated = await admin.post("/api/admin/pdf", {
      data: {
        kind: "PREVIEW",
        version: "test-preview",
        title: "Isolated reviewed preview",
        lessonIds: [lesson.id],
        questionIds: [question.id],
      },
    });
    expect(generated.status()).toBe(201);
    const previewId = (await generated.json()).id;
    expect((await anon.get("/api/preview.pdf")).status()).toBe(404);
    expect(
      (
        await admin.post("/api/admin/pdf", {
          data: { action: "publish", id: previewId, humanReviewed: false },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post("/api/admin/pdf", {
          data: { action: "publish", id: previewId, humanReviewed: true },
        })
      ).status(),
    ).toBe(200);
    const publicPdf = await anon.get("/api/preview.pdf");
    expect(publicPdf.status()).toBe(200);
    const bytes = await publicPdf.body();
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBeGreaterThan(5);
    let internalLinks = 0;
    for (const page of document.getPages()) {
      const annots = page.node.Annots();
      if (annots)
        for (let i = 0; i < annots.size(); i++) {
          const entry = annots.lookup(i, PDFDict);
          if (entry.has(PDFName.of("Dest"))) internalLinks++;
        }
    }
    expect(internalLinks).toBeGreaterThan(0);
    await mkdir(".local", { recursive: true });
    const proofPath = path.resolve(".local/phase2-test-proof.pdf");
    await writeFile(proofPath, bytes);
    const text = execFileSync("pdftotext", [proofPath, "-"], {
      encoding: "utf8",
    });
    expect(text).toContain("Copyright");
    expect(text).toContain("30-day study calendar");
    expect(text).toContain("Isolated reviewed preview");
    expect(text).toContain("test-preview");
    expect(text).toContain("pag-aaral");
    expect(text).toContain("₱160");
    const edition = await db.pdfEdition.findUniqueOrThrow({
      where: { id: previewId },
    });
    expect(edition.sha256 === digest(bytes)).toBe(true);
    const file = path.join(process.env.PDF_PRIVATE_DIR!, edition.filename);
    await writeFile(file, Buffer.from("tampered"));
    expect((await anon.get("/api/preview.pdf")).status()).toBe(409);
    await writeFile(file, bytes);
    // Staff UI uses the same authorization and server-maintained state.
    const ui = await browser.newContext({
      storageState: await admin.storageState(),
    });
    const page = await ui.newPage();
    await page.goto(`${base}/admin`);
    await expect(
      page.getByRole("heading", { name: "Make every explanation count." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "PDF workspace" }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/phase2-editorial-studio.png",
      fullPage: true,
    });
    await ui.close();
    expect(
      (
        await admin.post("/api/admin/questions", {
          data: {
            action: "archive",
            id: question.id,
            revision: question.revision,
          },
        })
      ).status(),
    ).toBe(200);
    expect((await anon.get("/api/preview.pdf")).status()).toBe(409);
    expect(
      await db.auditEvent.count({
        where: { actorId: { in: users.map((u) => u.id) } },
      }),
    ).toBeGreaterThan(5);
  } finally {
    for (const ctx of contexts) await ctx.dispose();
    await db.$disconnect();
  }
});
