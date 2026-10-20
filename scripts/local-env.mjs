import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
if (existsSync(".env")) {
  console.log("Existing .env preserved.");
} else if (process.env.DATABASE_URL) {
  console.log(
    "Injected DATABASE_URL preserved. Configure Docker variables separately if using local Compose.",
  );
} else {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env",
    `DATABASE_URL="postgresql://csc_dev:${password}@localhost:5432/csc_reviewer?schema=public"\nPOSTGRES_USER=csc_dev\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=csc_reviewer\nAPP_URL=http://localhost:3000\nPRICE_BASIC_PHP=99\nPRICE_COMPLETE_PHP=199\nPRICE_PREMIUM_PHP=399\nPAYMENT_PROVIDER=mock\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Created ignored .env with a random local database password.");
}
