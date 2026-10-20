import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { hashPassword } from "../src/lib/security";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      role: { type: "string" },
      name: { type: "string" },
    },
  });
  if (process.stdin.isTTY)
    throw new Error(
      "Supply the password on standard input from a private file or secure prompt; never as a command argument.",
    );
  const email = z.email().max(254).parse(values.email).toLowerCase();
  const role = z
    .enum(["ADMIN", "EDITOR", "REVIEWER", "CUSTOMER"])
    .parse(values.role ?? "CUSTOMER");
  const password = z
    .string()
    .min(12)
    .max(128)
    .parse(readFileSync(0, "utf8").replace(/\r?\n$/, ""));
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: values.name ?? null, role, passwordHash },
    });
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: "operator.account.create",
        targetId: user.id,
        metadata: { role },
      },
    });
  });
  console.log(
    `Account created with ${role} role. No password or session token is logged.`,
  );
}
main()
  .catch(() => {
    console.error(
      "Account creation failed. Check email, role, password length, database access and whether the account already exists. Password must be supplied on stdin.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
