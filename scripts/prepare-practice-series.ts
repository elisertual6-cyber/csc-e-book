import "dotenv/config";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { loadPracticeSeries } from "../src/lib/series-manifest";
import { practiceSeriesKey, validSeriesSettings } from "../src/lib/practice-series-policy";
class PreparationError extends Error {}
async function main() {
  if (process.argv.slice(2).join(" ") !== "--apply") throw new PreparationError("Use --apply to prepare inactive practice sets.");
  const email = z.email().max(254).safeParse(process.env.ADMIN_EMAIL?.trim());
  if (!email.success || !process.env.DATABASE_URL) throw new PreparationError("Configure the intended database and ADMIN_BOOTSTRAP_EMAIL privately.");
  const sets = loadPracticeSeries();
  const created = await getDb().$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73642021)`;
    const identities = await tx.$queryRaw<{ id: string; role: string }[]>`SELECT id,role FROM "User" WHERE email=${email.data.toLowerCase()} FOR SHARE`;
    if (identities[0]?.role !== "ADMIN") throw new PreparationError("A current matching ADMIN is required.");
    const existingKeys = new Set((await tx.question.findMany({ where: { key: { in: sets.flatMap(set => set.questions.map(q => q.key)) } }, select: { key: true }, distinct: ["key"] })).map(q => q.key));
    if (existingKeys.size !== 800) throw new PreparationError("Import all five draft sets before preparing the series.");
    let count = 0;
    for (const set of sets) {
      const data = { slug: `practice-series-v1-set-${set.position}`, title: set.title, level: "COMMON" as const,
        mode: "PRACTICE" as const, access: "FREE" as const, topics: [...new Set(set.questions.map(q => q.topic))],
        questionCount: 160, durationSeconds: 0, seriesKey: practiceSeriesKey, setPosition: set.position,
        questionKeys: set.questions.map(q => q.key) };
      const existing = await tx.examTemplate.findUnique({ where: { slug: data.slug } });
      if (existing) {
        if (!validSeriesSettings(existing) || existing.setPosition !== data.setPosition || existing.title !== data.title ||
          existing.questionKeys.some((key, index) => key !== data.questionKeys[index]))
          throw new PreparationError("An existing set conflicts with the fixed manifest. Existing records were preserved.");
        continue;
      }
      await tx.examTemplate.create({ data });
      count++;
    }
    await tx.auditEvent.create({ data: { actorId: identities[0].id, action: "practice-series.prepare", targetId: practiceSeriesKey,
      metadata: { created: count, sets: 5, questionsPerSet: 160, contentStatus: "DRAFT", activation: "unchanged" } } });
    return count;
  }, { isolationLevel: "Serializable", timeout: 180000 });
  console.log(`Prepared ${created} inactive practice sets. Existing records were preserved; no questions were reviewed, published or activated.`);
}
void main().catch(error => { console.error(error instanceof PreparationError ? error.message : "Practice set preparation failed and rolled back. No private details were logged."); process.exitCode = 1; })
  .finally(() => getDb().$disconnect());
