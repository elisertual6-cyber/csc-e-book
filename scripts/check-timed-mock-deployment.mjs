// Public read-only rollout probe. No sessions, credentials or customer mutations.
import { setTimeout } from "node:timers/promises";
const target = "https://csc-e-book.vercel.app/practice";
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(target, { redirect: "error", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(10000) });
    const html = await response.text();
    if (response.ok && /Timed draft mocks are labelled/.test(html)) { ready = true; break; }
  } catch { /* Deployment may still be changing. Never log provider error bodies. */ }
  await setTimeout(5000);
}
console.log(ready ? "Live practice page includes the timed draft mock update." : "Timed mock database release succeeded; live web deployment still needs checking.");
if (!ready) process.exitCode = 1;
