// Read-only diagnostic: no deployment, account, database or content mutations.
import { appendFile } from "node:fs/promises";
const repository = "elisertual6-cyber/csc-e-book";
const sourceSha = "963eee1db610b0b85396c3af49ac0167a96cefc9";
const origin = "https://csc-e-book.vercel.app";
const result = {};
const clean = value => String(value).replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 150);
function deploymentReason(value) {
  const text = String(value);
  if (/limit|quota/i.test(text)) return "deployment quota";
  if (/author|access|member|team|permission|not authorized/i.test(text)) return "Git or project access";
  if (/cancel/i.test(text)) return "deployment cancelled";
  if (/fail|error/i.test(text)) return "build or deployment failed";
  if (/ready|completed|success/i.test(text)) return "deployment completed";
  if (/pending|queued|running|building|progress/i.test(text)) return "deployment pending";
  return "provider status";
}
async function readJson(path) {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(20000), redirect: "error",
  });
  if (!response.ok) return { unavailable: response.status };
  return response.json();
}
try {
  const [status, checks] = await Promise.all([readJson(`commits/${sourceSha}/status`), readJson(`commits/${sourceSha}/check-runs`)]);
  const vercel = status.statuses?.find(item => /vercel/i.test(item.context));
  const check = checks.check_runs?.find(item => /vercel/i.test(item.name));
  result.vercel = vercel ? `Vercel ${vercel.state}: ${deploymentReason(vercel.description)}`
    : check ? `Vercel ${check.conclusion ?? check.status}: ${deploymentReason(check.output?.title ?? "")}` : "No Vercel status found for removal commit";
} catch { result.vercel = "Vercel status could not be read"; }
for (const path of ["/lessons", "/reviewers"]) {
  try {
    const response = await fetch(`${origin}${path}`, { redirect: "manual", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(20000) });
    const location = response.headers.get("location");
    const text = await response.text();
    const old = /Free draft lessons\./.test(text);
    const reviewer = /A reviewer for every step forward\./.test(text);
    result[path === "/lessons" ? "lessons" : "reviewers"] = `${path} HTTP ${response.status}${location ? (new URL(location, origin).href === `${origin}/reviewers` ? " to /reviewers" : " other redirect") : old ? " old listing" : reviewer ? " new library" : " other page"}`;
    result[path === "/lessons" ? "redirect_ok" : "reviewer_ok"] = path === "/lessons"
      ? [307, 308].includes(response.status) && location !== null && new URL(location, origin).href === `${origin}/reviewers`
      : response.status === 200 && reviewer && !old;
  } catch { result[path === "/lessons" ? "lessons" : "reviewers"] = `${path} unavailable`; }
}
result.healthy = result.redirect_ok === true && result.reviewer_ok === true;
for (const [key, value] of Object.entries(result)) {
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${clean(value)}\n`);
}
console.log(JSON.stringify(result));
