import { api, json } from "@/lib/http";
import { catalog } from "@/lib/commerce";
export async function GET() {
  return api(async () => json(await catalog()));
}
