import "dotenv/config";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { mailDirectory } from "../src/lib/mail";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const now = new Date();
  const sessions = await db.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const limits = await db.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const messages = await db.mailMessage.updateMany({
    where: { expiresAt: { lt: now }, encryptedPayload: { not: null } },
    data: {
      encryptedPayload: null,
      status: "CANCELLED",
      leaseUntil: null,
      leaseKey: null,
    },
  });
  const tokens = await db.accountToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const dir = mailDirectory();
  let files = 0;
  try {
    for (const entry of await readdir(dir))
      if (/^[a-z0-9]+\.json$/.test(entry)) {
        const file = path.join(dir, entry);
        const metadata = await stat(file);
        if (metadata.mtimeMs < now.getTime() - 86400000) {
          await unlink(file);
          files++;
        }
      }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  console.log(
    `Removed ${sessions.count} expired session(s) and ${limits.count} expired rate-limit bucket(s); erased ${messages.count} expired mail payload(s), ${tokens.count} expired account token(s) and ${files} old private inbox file(s).`,
  );
}
main()
  .catch(() => {
    console.error("Maintenance failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
