import { api, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { staffRoles } from "@/lib/security";
import { getDb } from "@/lib/db";
import { readEdition } from "@/lib/pdf";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    await requireUser(staffRoles);
    const { id } = await params;
    const edition = await getDb().pdfEdition.findUnique({ where: { id } });
    if (!edition) throw new HttpError(404, "PDF not found.");
    return new Response(new Uint8Array(await readEdition(edition)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="editorial-proof.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
