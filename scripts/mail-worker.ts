import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  processMailBatch,
  queuePurchaseNotices,
  mailTransport,
} from "../src/lib/mail";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  try {
    if (mailTransport() === "disabled") throw new Error("Mail disabled.");
    const queued = await queuePurchaseNotices(db);
    const result = await processMailBatch(db);
    console.log(JSON.stringify({ queuedPurchaseNotices: queued, ...result }));
  } catch {
    console.error(
      "Mail worker could not complete. Check private configuration and queue status; message bodies and credentials are never logged.",
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
void main();
