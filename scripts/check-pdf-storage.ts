import "dotenv/config";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { checkPrivatePdfStorage, PdfStorageCheckError } from "../src/lib/pdf-storage-check";

async function main() {
  try {
    // Explicit opt-in: this diagnostic creates and deletes one private object.
    if (process.argv.slice(2).join(" ") !== "--apply") {
      console.error("Use --apply to upload, verify and remove one synthetic private PDF. No database records are changed.");
      process.exitCode = 1;
      return;
    }
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    document.addPage().drawText("SYNTHETIC PRIVATE STORAGE CHECK - NOT AN EDITION", { x: 40, y: 720, size: 12, font });
    const result = await checkPrivatePdfStorage(Buffer.from(await document.save()));
    console.log(JSON.stringify({ privatePdfStorage: "verified", ...result }));
  } catch (error) {
    console.error(error instanceof PdfStorageCheckError ? error.message : "Private PDF storage check failed before verification.");
    console.error("Check secure storage settings and provider availability. No provider response, object key or credential is logged. This check does not verify application roles, recovery or paid delivery.");
    process.exitCode = 1;
  }
}
void main();
