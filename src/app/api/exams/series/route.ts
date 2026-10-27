import { api, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { practiceSeriesProgress } from "@/lib/practice-series";
export async function GET() {
  return api("exam", async () => json(await practiceSeriesProgress((await requireUser()).id)));
}
