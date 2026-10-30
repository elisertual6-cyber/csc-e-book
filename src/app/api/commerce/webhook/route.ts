import { api, HttpError, json } from "@/lib/http";
import { processGcashWebhook } from "@/lib/gcash";
import { paymongoConfig } from "@/lib/paymongo";
import { schedulePurchaseMail } from "@/lib/purchase-mail-delivery";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return api("commerce", async () => {
    paymongoConfig(undefined, true);
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
    const result = await processGcashWebhook(
        Buffer.concat(chunks),
        request.headers.get("paymongo-signature"),
      );
    if ("orderId" in result) schedulePurchaseMail(result);
    return json(result);
  });
}
