import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseArgs } from "node:util";
import { z } from "zod";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, role: { type: "string" } },
  });
  const email = z.email().parse(values.email).toLowerCase();
  const role = z
    .enum(["ADMIN", "EDITOR", "REVIEWER", "CUSTOMER"])
    .parse(values.role);
  await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { email },
      data: { role, authVersion: { increment: 1 } },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: "operator.role.change",
        targetId: user.id,
        metadata: { role, source: "local-operator-cli" },
      },
    });
  });
  console.log("Role changed. Existing sessions revoked.");
}
main()
  .catch(() => {
    console.error("Role update failed. Check email, role and database access.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
