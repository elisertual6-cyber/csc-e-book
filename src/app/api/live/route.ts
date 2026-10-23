import { api, json } from "@/lib/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  return api("live", async () => json({ status: "ok" }));
}
