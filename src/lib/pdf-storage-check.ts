import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  pdfStorageMode, writePrivatePdf, readPrivatePdf, removePrivatePdf,
  checkAnonymousPdfDenial, confirmPrivatePdfRemoved,
} from "./pdf-storage";

export class PdfStorageCheckError extends Error {
  constructor(public stage: "configuration" | "upload" | "integrity" | "anonymous-denial" | "cleanup") {
    super(`Private PDF storage check failed at ${stage}.`);
  }
}
// The caller supplies a synthetic PDF, never an edition/customer file.
export async function checkPrivatePdfStorage(probe: Buffer) {
  let stage: PdfStorageCheckError["stage"] = "configuration";
  let uploaded: string | undefined;
  let failure: PdfStorageCheckError | undefined;
  try {
    if (pdfStorageMode() !== "supabase") throw new Error();
    stage = "upload";
    uploaded = await writePrivatePdf(`${randomUUID()}.pdf`, probe);
    stage = "integrity";
    const bytes = await readPrivatePdf(uploaded);
    const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
    if (hash(bytes) !== hash(probe)) throw new Error();
    stage = "anonymous-denial";
    await checkAnonymousPdfDenial(uploaded);
  } catch { failure = new PdfStorageCheckError(stage); }
  finally {
    if (uploaded) {
      try {
        await removePrivatePdf(uploaded);
        await confirmPrivatePdfRemoved(uploaded);
      } catch { failure = new PdfStorageCheckError("cleanup"); }
    }
  }
  if (failure) throw failure;
  return { upload: "ok", integrity: "ok", anonymousDenial: "ok", cleanup: "ok" } as const;
}
