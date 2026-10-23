import "server-only";
import { Pool } from "pg";

// A small, separately bounded diagnostic pool: health probes cannot occupy
// application transaction slots or change editorial/exam transaction timeouts.
const globalReadiness = globalThis as unknown as { readinessPool?: Pool };
export async function checkDatabaseReadiness() {
  if (!process.env.DATABASE_URL) return false;
  const pool = globalReadiness.readinessPool ?? new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 2000,
    statement_timeout: 2000,
    query_timeout: 2500,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  if (!globalReadiness.readinessPool) {
    // pg idle-client errors would otherwise become uncaught process errors.
    // The next probe reports readiness; never log connection exception details.
    pool.on("error", () => {});
    globalReadiness.readinessPool = pool;
  }
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
