import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function getDb() {
  // Initialize only for database work, so public builds do not open a pool.
  const db =
    globalDb.prisma ??
    new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  globalDb.prisma = db;
  return db;
}
