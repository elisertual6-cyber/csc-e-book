import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { hashPassword } from "../src/lib/security";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
class AccountInputError extends Error {}
let stage: "input" | "hash" | "database" = "input";
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      role: { type: "string" },
      name: { type: "string" },
    },
  });
  if (process.stdin.isTTY)
    throw new AccountInputError(
      "Supply the password on standard input from a private file or secure prompt; never as a command argument.",
    );
  const emailInput = z.email().max(254).safeParse(values.email?.trim());
  if (!emailInput.success)
    throw new AccountInputError("Invalid email. Set ADMIN_BOOTSTRAP_EMAIL to a valid email address only.");
  const email = emailInput.data.toLowerCase();
  const roleInput = z
    .enum(["ADMIN", "EDITOR", "REVIEWER", "CUSTOMER"])
    .safeParse(values.role ?? "CUSTOMER");
  if (!roleInput.success) throw new AccountInputError("Invalid account role.");
  const role = roleInput.data;
  const passwordInput = z
    .string()
    .min(12)
    .max(128)
    .safeParse(readFileSync(0, "utf8").replace(/\r?\n$/, ""));
  if (!passwordInput.success)
    throw new AccountInputError("Invalid password length. Set ADMIN_BOOTSTRAP_PASSWORD to a unique password of 12–128 characters; no value is logged.");
  const password = passwordInput.data;
  stage = "hash";
  const passwordHash = await hashPassword(password);
  stage = "database";
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
  .catch((error: unknown) => {
    // Only fixed messages and categories are public. Never print Prisma/Zod
    // exceptions, input values, database URLs or constraint metadata.
    let message = "Account input could not be read. Use valid CLI options and supply the password on stdin.";
    if (error instanceof AccountInputError) message = error.message;
    else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      message = "Account already exists. No password or role was changed. Sign in with the original credentials or use the documented operator recovery procedure.";
    else if (stage === "database")
      message = "Database write failed. Check connection permissions and account/audit table access. Provider details were not logged.";
    else if (stage === "hash") message = "Password hashing failed. Check runner resources; no credentials were logged.";
    console.error(`Account creation failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
