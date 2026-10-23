import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrations use a direct/session connection, not a transaction pooler.
    // The application adapter still reads DATABASE_URL only.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://localhost:5432/csc_reviewer",
  },
});
