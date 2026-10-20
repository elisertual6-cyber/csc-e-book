import { spawnSync } from "node:child_process";
import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".local/backups");
function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, ["scripts/backup.mjs", ...args], { encoding: "utf8" });
  if (result.error || result.status !== expectedStatus) throw new Error("Backup safety check failed.");
  return result.stdout + result.stderr;
}
// Caller must pause writers just as for an ordinary backup.
if (!process.argv.includes("--writes-paused")) throw new Error("Pause app/worker writes; rerun with --writes-paused.");
let previous = [];
try { previous = await readdir(root); } catch (error) { if (error.code !== "ENOENT") throw error; }
let id;
try {
  run(["create", "--writes-paused"]);
  const added = (await readdir(root)).filter((entry) => !previous.includes(entry));
  if (added.length !== 1 || !/^[a-f0-9-]{36}$/.test(added[0])) throw new Error("Could not identify isolated test backup.");
  id = added[0];
  console.log(run(["verify", id]).trim());
  const dump = path.join(root, id, "database.dump");
  const bytes = await readFile(dump);
  await writeFile(dump, Buffer.concat([bytes, Buffer.from("corruption")]));
  if (!run(["verify", id], 1).includes("checksum mismatch")) throw new Error("Corrupted backup was not refused.");
  if (!run(["verify", "../../unrelated"], 1).includes("generated backup UUID")) throw new Error("Unsafe restore path was not refused.");
  console.log("Corruption and unsafe restore paths rejected; generated test backup removed.");
} finally {
  if (id) await rm(path.join(root, id), { recursive: true, force: true });
}
