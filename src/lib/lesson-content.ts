import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { findDraftLesson } from "./lesson-catalog";

export async function readDraftLesson(slug: string) {
  const lesson = findDraftLesson(slug);
  if (!lesson) return null;
  // Only a fixed catalog entry can supply a filename; never the route input.
  const markdown = await readFile(path.join(process.cwd(), "content/lessons", `${lesson.slug}.md`), "utf8");
  return { ...lesson, markdown };
}
