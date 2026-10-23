import { api } from "@/lib/http";
import { publicPreview } from "@/lib/pdf";
export async function GET() {
  return api("preview", async () => {
    const { bytes } = await publicPreview();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'inline; filename="csc-study-reviewed-preview.pdf"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
