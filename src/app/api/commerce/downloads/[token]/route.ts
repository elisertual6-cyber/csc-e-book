import { api } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { consumeDownload } from "@/lib/commerce";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  return api(async () => {
    const actor = await requireUser();
    await rateLimit("download-consume", actor.id, 30);
    const bytes = await consumeDownload(actor, (await params).token);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="csc-study-reviewer.pdf"',
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
