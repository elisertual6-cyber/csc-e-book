import { readdirSync, readFileSync, lstatSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function checkBuildTraces(root = process.cwd()) {
  const output = path.resolve(root, ".next");
  const manifests = [];
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (directory === output && entry.isDirectory() && ["cache", "dev"].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith(".nft.json")) manifests.push(file);
    }
  }
  scan(output);
  if (!manifests.length) throw new Error("No build trace manifests found; run the Next.js production build first.");
  const referenced = new Set();
  let temporary = 0;
  let missing = 0;
  for (const manifest of manifests) {
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    if (!Array.isArray(data.files) || data.files.some(file => typeof file !== "string")) throw new Error("Invalid build trace manifest.");
    for (const file of data.files) referenced.add(path.resolve(path.dirname(manifest), file));
  }
  for (const file of referenced) {
    const relative = path.relative(output, file).split(path.sep).join("/");
    if (/^(?:lock|trace|trace-build)$/.test(relative) || /^(?:cache|dev|diagnostics|types)\//.test(relative)) temporary++;
    try { lstatSync(file); } catch (error) {
      if (error.code === "ENOENT") missing++;
      else throw error;
    }
  }
  if (temporary || missing) throw new Error(`Build trace check failed: ${temporary} temporary artifact reference(s), ${missing} missing file reference(s).`);
  return { manifests: manifests.length, files: referenced.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = checkBuildTraces();
    console.log(`Build traces verified: ${result.manifests} manifests, ${result.files} existing runtime files; no temporary build artifacts.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Build trace validation failed.");
    process.exitCode = 1;
  }
}
