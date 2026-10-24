// Loaded only by the disposable recovery test subprocess. No real provider HTTP is permitted.
if (process.env.RECOVERY_TEST_MODE !== "disposable" || (!process.argv.includes("--restore-archive") && !/^postgresql:\/\/(?:postgres|missing_recovery_role):[a-f0-9]+@127\.0\.0\.1:\d+\/postgres\?sslmode=(?:disable|verify-full)$/.test(process.env.RECOVERY_SOURCE_URL ?? ""))) throw new Error("Disposable recovery fixture required.");
const origin = "https://abcdefghijklmnopqrst.supabase.co";
const filename = "12345678-1234-1234-1234-123456789abc.pdf";
const original = Buffer.from("%PDF-synthetic-recovery-proof");
const buckets = new Map([["private-editions", new Map([[filename, original]])]]);
let restored = 0;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  if (url.origin !== origin) throw new Error("External provider network forbidden in recovery fixture.");
  const parts = url.pathname.replace("/storage/v1/", "").split("/");
  const headers = new Headers(init.headers);
  if (headers.get("Authorization") !== "Bearer fixture-recovery-key") return new Response(null, { status: 403 });
  if (init.method === "POST" && parts.join("/") === "bucket") {
    const data = JSON.parse(init.body);
    if (!/^csc-restore-[a-f0-9-]{36}$/.test(data.id) || data.public !== false || buckets.has(data.id)) throw new Error("Unsafe fixture bucket create.");
    buckets.set(data.id, new Map()); return Response.json({});
  }
  if (parts[0] === "bucket") {
    const bucket = buckets.get(parts[1]);
    if (init.method === "DELETE") {
      if (parts[1] === "private-editions" || !bucket || bucket.size) throw new Error("Unsafe fixture bucket deletion.");
      buckets.delete(parts[1]); return Response.json({});
    }
    return bucket ? Response.json({ id: parts[1], public: false }) : new Response(null, { status: 404 });
  }
  if (parts[0] === "object") {
    if (["POST", "DELETE"].includes(init.method)) {
      const bucket = buckets.get(parts[1]);
      if (parts[1] === "private-editions" || !bucket) throw new Error("Source storage mutation forbidden.");
      if (init.method === "POST") {
        if (bucket.has(parts[2]) || headers.get("x-upsert") !== "false") throw new Error("Overwrite forbidden.");
        bucket.set(parts[2], Buffer.from(init.body)); restored++;
      } else for (const name of JSON.parse(init.body).prefixes) bucket.delete(name);
      return Response.json({});
    }
    const bytes = buckets.get(parts[2])?.get(parts[3]);
    return bytes ? new Response(new Uint8Array(process.env.RECOVERY_TEST_CORRUPT_RESTORE === "true" && parts[2] !== "private-editions" ? Buffer.from("corrupted-restored-object") : bytes)) : new Response(null, { status: 404 });
  }
  throw new Error("Unexpected fixture storage request.");
};
process.on("exit", () => {
  if ((!process.exitCode && !restored) || buckets.size !== 1 || !buckets.get("private-editions")?.get(filename)?.equals(original)) {
    console.error("Disposable recovery fixture isolation/cleanup check failed."); process.exitCode = 1;
  }
});
