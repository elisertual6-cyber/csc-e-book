import { api, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { templatesFor } from "@/lib/exams";
export async function GET() {
  return api(async () => json(await templatesFor(await requireUser())));
}
