import { api, HttpError, json } from "@/lib/http";
import { processGcashWebhook } from "@/lib/gcash";
import { paymongoConfig } from "@/lib/paymongo";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    paymongoConfig();
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "A payment event is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256000) {
        await reader.cancel();
        throw new HttpError(413, "Payment event is too large.");
      }
      chunks.push(value);
    }
    return json(
      await processGcashWebhook(
        Buffer.concat(chunks),
        request.headers.get("paymongo-signature"),
      ),
    );
  });
}
