import { api, json } from "@/lib/http";
import { catalog } from "@/lib/commerce";
export async function GET() {
  return api("commerce", async () => json(await catalog()));
}
