import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import pack from "../content/editorial/numerical-foundations.json";
import { questionImportRows } from "../src/lib/draft-pack";
test("only an editor can import the authored pack and all records remain unapproved drafts", async ({ request }) => {
  const database = new URL(process.env.DATABASE_URL ?? "");
  expect(database.pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" };
  const rows = questionImportRows(pack);
  const data = { format: "json", data: JSON.stringify(rows) };
  expect((await request.post("/api/admin/questions/transfer", { headers, data })).status()).toBe(401);
  const email = `draft-editor-${randomUUID()}@example.test`;
  expect((await request.post("/api/auth/register", { headers, data: { name: "Draft pack test editor", email, password: randomUUID() + "-study" } })).status()).toBe(201);
  expect((await request.post("/api/admin/questions/transfer", { headers, data })).status()).toBe(403);
  const db = new Client({ connectionString: database.toString() });
  await db.connect();
  try {
    // Synthetic role setup only in the runner's disposable database.
    await db.query('UPDATE "User" SET role = \'EDITOR\' WHERE email = $1', [email]);
    const imported = await request.post("/api/admin/questions/transfer", { headers, data });
    expect(imported.status()).toBe(201);
    expect(await imported.json()).toEqual({ created: 20 });
    const records = (await db.query('SELECT status, "authorId" FROM "Question" WHERE key = ANY($1::text[])', [rows.map(q => q.key)])).rows;
    expect(records).toHaveLength(20);
    expect(records.every(q => q.status === "DRAFT" && q.authorId)).toBe(true);
    expect((await db.query('SELECT count(*)::int AS count FROM "Review" r JOIN "Question" q ON q.id = r."questionId" WHERE q.key = ANY($1::text[])', [rows.map(q => q.key)])).rows[0].count).toBe(0);
    const malformed = rows.map((q, i) => i ? q : { ...q, choices: q.choices.map(c => ({ ...c, isCorrect: true })) });
    expect((await request.post("/api/admin/questions/transfer", { headers, data: { format: "json", data: JSON.stringify(malformed) } })).status()).toBe(400);
    expect((await db.query('SELECT count(*)::int AS count FROM "Question" WHERE key = ANY($1::text[])', [rows.map(q => q.key)])).rows[0].count).toBe(20);
  } finally { await db.end(); }
});
