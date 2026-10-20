import { json } from "@/lib/http";
// No provider is configured. Never interpret an unsigned payload or browser redirect as payment proof.
export async function POST() {
  return json({ error: "No verified payment provider is configured." }, 503);
}
