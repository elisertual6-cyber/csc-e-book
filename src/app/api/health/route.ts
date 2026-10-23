import { api, json } from "@/lib/http";
import { checkDatabaseReadiness } from "@/lib/readiness";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  return api("health", async () => {
    const ready = await checkDatabaseReadiness();
    return json({ status: ready ? "ok" : "degraded", database: ready ? "connected" : "unavailable" }, ready ? 200 : 503);
  });
}
