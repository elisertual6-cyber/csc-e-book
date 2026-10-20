export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { getDb } = await import("@/lib/db");
    await getDb().$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", database: "connected", phase: "foundation" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unavailable", phase: "foundation" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
