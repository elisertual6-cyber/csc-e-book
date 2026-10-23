import { z } from "zod";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { requireUser, rateLimit } from "@/lib/auth";
import { api, assertMutation, readJson, json, HttpError } from "@/lib/http";
import { staffRoles, writerRoles } from "@/lib/security";
import { getDb } from "@/lib/db";
import { createDrafts, questionInput } from "@/lib/editorial";
export async function GET(request: Request) {
  return api("admin", async () => {
    await requireUser(staffRoles);
    const questions = await getDb().question.findMany({
      include: { choices: true, explanation: true },
      orderBy: [{ key: "asc" }, { version: "desc" }],
    });
    const seen = new Set<string>();
    const data = questions
      .filter((q) => {
        if (seen.has(q.key)) return false;
        seen.add(q.key);
        return true;
      })
      .map((q) => ({
        key: q.key,
        prompt: q.prompt,
        topic: q.topic,
        level: q.level,
        difficulty: q.difficulty,
        sourceNotes: q.sourceNotes,
        explanation: q.explanation?.rationale ?? "",
        choices: [...q.choices]
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((c) => ({
            label: c.label,
            text: c.text,
            isCorrect: c.isCorrect,
          })),
      }));
    const csv = new URL(request.url).searchParams.get("format") === "csv";
    const output = csv
      ? stringify(
          data.map((q) => ({
            key: q.key,
            prompt: q.prompt,
            topic: q.topic,
            level: q.level,
            difficulty: q.difficulty,
            sourceNotes: q.sourceNotes,
            explanation: q.explanation,
            ...Object.fromEntries(
              q.choices.map((c) => [`option${c.label}`, c.text]),
            ),
            correctLabel: q.choices.find((c) => c.isCorrect)?.label,
          })),
          { header: true, escape_formulas: true },
        )
      : JSON.stringify(data, null, 2);
    return new Response(output, {
      headers: {
        "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json",
        "Content-Disposition": `attachment; filename="questions.${csv ? "csv" : "json"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
export async function POST(request: Request) {
  return api("admin", async () => {
    assertMutation(request);
    const actor = await requireUser(writerRoles);
    await rateLimit("import", actor.id, 5);
    const body = z
      .object({
        format: z.enum(["json", "csv"]),
        data: z.string().max(450_000),
      })
      .strict()
      .parse(await readJson(request));
    let rows: unknown[];
    try {
      rows =
        body.format === "json"
          ? z.array(z.unknown()).max(100).parse(JSON.parse(body.data))
          : (
              parse(body.data, {
                columns: true,
                skip_empty_lines: true,
                bom: true,
                max_record_size: 50_000,
              }) as Record<string, string>[]
            ).map((row) => ({
              key: row.key,
              prompt: row.prompt,
              topic: row.topic,
              level: row.level,
              difficulty: row.difficulty,
              sourceNotes: row.sourceNotes,
              explanation: row.explanation,
              choices: ["A", "B", "C", "D"].map((label) => ({
                label,
                text: row[`option${label}`],
                isCorrect: row.correctLabel === label,
              })),
            }));
    } catch {
      throw new HttpError(400, "Invalid import format.");
    }
    const inputs = rows.map((row) => questionInput.parse(row));
    if (new Set(inputs.map((q) => q.key)).size !== inputs.length)
      throw new HttpError(400, "Duplicate keys in import.");
    return json(
      { created: (await createDrafts(actor, "questions", inputs)).length },
      201,
    );
  });
}
