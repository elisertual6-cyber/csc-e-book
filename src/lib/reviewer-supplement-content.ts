import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findReviewerSupplement } from "./reviewer-supplements";
export async function readReviewerSupplement(guide: string) {
  const lesson = findReviewerSupplement(guide);
  if (!lesson) return null;
  const markdown = await readFile(path.join(process.cwd(), "content/reviewer-lessons", lesson.file), "utf8");
  return { ...lesson, markdown };
}
