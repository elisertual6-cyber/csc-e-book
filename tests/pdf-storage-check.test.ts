import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkPrivatePdfStorage } from "../src/lib/pdf-storage-check";
const probe = Buffer.from("%PDF-synthetic-fixture");
const origin = "https://abcdefghijklmnopqrst.supabase.co";
function fixture(options: { publicStatus?: number; corrupt?: boolean; deleteFails?: boolean; stillExists?: boolean; wrapped404?: boolean; missingStatus?: number; staleCache?: boolean } = {}) {
  vi.stubEnv("PDF_STORAGE", "supabase");
  vi.stubEnv("PDF_SUPABASE_URL", origin);
  vi.stubEnv("PDF_SUPABASE_BUCKET", "private-editions");
  vi.stubEnv("PDF_SUPABASE_SERVICE_KEY", "fixture-service-key");
  let object: Buffer | undefined;
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("/bucket/")) return Response.json({ id: "private-editions", public: false });
    if (init.method === "POST") { object = Buffer.from(init.body as Uint8Array); return Response.json({}); }
    if (init.method === "DELETE") {
      if (options.deleteFails) return new Response(null, { status: 500 });
      if (!options.stillExists) object = undefined;
      return Response.json([]);
    }
    const headers = init.headers as Record<string, string> | undefined;
    if (!headers?.Authorization) return new Response(null, { status: options.publicStatus ?? 400 });
    if (!object) {
      if (options.staleCache && !new URL(url).searchParams.has("cacheNonce"))
        return new Response(new Uint8Array(probe));
      if (options.wrapped404) return Response.json({ statusCode: "404" }, { status: 400 });
      return new Response(null, { status: options.missingStatus ?? 404 });
    }
    return new Response(new Uint8Array(options.corrupt ? Buffer.from("tampered") : object));
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("private storage rollout check", () => {
  it("verifies a synthetic round trip and removes only its generated object", async () => {
    const fetcher = fixture();
    expect(await checkPrivatePdfStorage(probe)).toEqual({ upload: "ok", integrity: "ok", anonymousDenial: "ok", cleanup: "ok" });
    const upload = fetcher.mock.calls.find(([, init]) => init.method === "POST")!;
    const name = upload[0].split("/").at(-1)!;
    expect(name).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    expect(fetcher.mock.calls.find(([, init]) => init.method === "DELETE")![1].body).toBe(JSON.stringify({ prefixes: [name] }));
    const anonymous = fetcher.mock.calls.filter(([, init]) => !init.headers);
    expect(anonymous).toHaveLength(2);
    expect(anonymous.every(([, init]) => init.redirect === "error")).toBe(true);
  });
  it("cleans up after checksum corruption", async () => {
    const fetcher = fixture({ corrupt: true });
    await expect(checkPrivatePdfStorage(probe)).rejects.toMatchObject({ stage: "integrity" });
    expect(fetcher.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(true);
  });
  it.each([200, 302, 500])("does not count public status %s as denial and still cleans up", async (publicStatus) => {
    const fetcher = fixture({ publicStatus });
    await expect(checkPrivatePdfStorage(probe)).rejects.toMatchObject({ stage: "anonymous-denial" });
    expect(fetcher.mock.calls.some(([, init]) => init.method === "DELETE")).toBe(true);
  });
  it.each([{ deleteFails: true }, { stillExists: true }, { missingStatus: 403 }, { missingStatus: 503 }])("does not report success after failed cleanup: %j", async (options) => {
    fixture(options);
    await expect(checkPrivatePdfStorage(probe)).rejects.toMatchObject({ stage: "cleanup" });
  });
  it("recognizes a provider's wrapped object-not-found response", async () => {
    fixture({ wrapped404: true });
    await expect(checkPrivatePdfStorage(probe)).resolves.toHaveProperty("cleanup", "ok");
  });
  it("bypasses cached integrity bytes when confirming deletion", async () => {
    const fetcher = fixture({ staleCache: true });
    await expect(checkPrivatePdfStorage(probe)).resolves.toHaveProperty("cleanup", "ok");
    const confirmation = new URL(fetcher.mock.calls.at(-1)![0]);
    expect(confirmation.searchParams.get("cacheNonce")).toMatch(/^[a-f0-9-]{36}$/);
  });
  it("refuses local mode without network or file writes", async () => {
    const fetcher = fixture(); vi.stubEnv("PDF_STORAGE", "disk");
    await expect(checkPrivatePdfStorage(probe)).rejects.toMatchObject({ stage: "configuration" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
