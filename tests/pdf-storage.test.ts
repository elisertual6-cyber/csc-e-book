import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readEdition } from "../src/lib/pdf";
import { createHash } from "node:crypto";
import { readPrivatePdf, writePrivatePdf, removePrivatePdf, pdfStorageMode } from "../src/lib/pdf-storage";
const name = "12345678-1234-1234-1234-123456789abc.pdf";
const origin = "https://abcdefghijklmnopqrst.supabase.co";
function setup() {
  vi.stubEnv("PDF_STORAGE", "supabase");
  vi.stubEnv("PDF_SUPABASE_URL", origin);
  vi.stubEnv("PDF_SUPABASE_BUCKET", "private-editions");
  vi.stubEnv("PDF_SUPABASE_SERVICE_KEY", "test-private-key");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const bucket = () => Response.json({ id: "private-editions", public: false });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("private PDF storage boundary", () => {
  it("uploads create-only, checks bucket privacy, and retains a backend reference", async () => {
    const fetcher = setup().mockResolvedValueOnce(bucket()).mockResolvedValueOnce(Response.json({ Key: name }));
    expect(await writePrivatePdf(name, Buffer.from("%PDF-test"))).toBe(`supabase:${name}`);
    expect(fetcher.mock.calls[1][0]).toBe(`${origin}/storage/v1/object/private-editions/${name}`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", headers: { "x-upsert": "false", Authorization: "Bearer test-private-key" } });
  });
  it("rejects public buckets before uploading or reading", async () => {
    const fetcher = setup().mockImplementation(async () => Response.json({ id: "private-editions", public: true }));
    await expect(writePrivatePdf(name, Buffer.from("proof"))).rejects.toThrow("unavailable");
    await expect(readPrivatePdf(`supabase:${name}`)).rejects.toThrow("unavailable");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("reads through authenticated storage without issuing a public or signed URL", async () => {
    const fetcher = setup().mockResolvedValueOnce(bucket()).mockResolvedValueOnce(new Response("%PDF-private"));
    expect((await readPrivatePdf(`supabase:${name}`)).toString()).toBe("%PDF-private");
    expect(fetcher.mock.calls[1][0]).toContain("/object/authenticated/private-editions/");
  });
  it("retains checksum enforcement for remote edition bytes", async () => {
    const bytes = "%PDF-original";
    setup().mockImplementation(async (url: string) => url.includes("/bucket/") ? bucket() : new Response("%PDF-tampered"));
    await expect(readEdition({ filename: `supabase:${name}`, sha256: createHash("sha256").update(bytes).digest("hex") })).rejects.toThrow("integrity");
  });
  it("rejects paths and untrusted credential destinations before network calls", async () => {
    const fetcher = setup();
    await expect(readPrivatePdf("supabase:../secret.pdf")).rejects.toThrow();
    vi.stubEnv("PDF_SUPABASE_URL", "https://attacker.test");
    await expect(writePrivatePdf(name, Buffer.from("proof"))).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not fall back to disk or leak provider errors on upload failure", async () => {
    setup().mockResolvedValueOnce(bucket()).mockResolvedValueOnce(new Response("provider secret diagnostic", { status: 409 }));
    await expect(writePrivatePdf(name, Buffer.from("proof"))).rejects.toThrow("Private PDF storage is unavailable.");
  });
  it("bounds streamed downloads and cancels oversized responses", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32 * 1024 * 1024 + 1)); }, cancel });
    setup().mockResolvedValueOnce(bucket()).mockResolvedValueOnce(new Response(stream));
    await expect(readPrivatePdf(`supabase:${name}`)).rejects.toThrow("unavailable");
    expect(cancel).toHaveBeenCalled();
  });
  it("removes only the new object on database rollback", async () => {
    const fetcher = setup().mockResolvedValueOnce(bucket()).mockResolvedValueOnce(Response.json([]));
    await removePrivatePdf(`supabase:${name}`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "DELETE", body: JSON.stringify({ prefixes: [name] }) });
  });
  it("rejects unknown adapters and ephemeral disk on Vercel", () => {
    vi.stubEnv("PDF_STORAGE", "unknown");
    expect(pdfStorageMode).toThrow();
    vi.stubEnv("PDF_STORAGE", "disk"); vi.stubEnv("VERCEL", "1");
    expect(pdfStorageMode).toThrow();
  });
});
