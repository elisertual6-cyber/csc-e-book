import "dotenv/config";
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
  console.log(
    `Removed ${sessions.count} expired session(s) and ${limits.count} expired rate-limit bucket(s).`,
  );
}
main()
  .catch(() => {
    console.error("Maintenance failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
