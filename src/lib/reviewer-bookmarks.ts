import { findReviewerGuide, reviewerGuides, reviewerLessonTitle } from "./reviewer-catalog";
import { findReviewerSupplement } from "./reviewer-supplements";

// Optional public reading references only. Never store account or assessment data.
export const reviewerBookmarkStorageKey = "csc-study:reviewer-bookmarks:v1";
export type ReviewerBookmark = { guide: string; chapter: string };

export function bookmarkTarget(bookmark: ReviewerBookmark) {
  const guide = findReviewerGuide(bookmark.guide);
  if (!guide) return;
  const lesson = guide.lessons.find(slug => slug === bookmark.chapter);
  const supplement = bookmark.chapter === "extra-practice" ? findReviewerSupplement(guide.slug) : undefined;
  if (!lesson && !supplement) return;
  return {
    title: lesson ? reviewerLessonTitle(lesson) : supplement!.title,
    guideTitle: guide.title,
    href: `/reviewers/${guide.slug}#${lesson ?? "extra-practice"}`,
  };
}

export function readReviewerBookmarks(raw: string): ReviewerBookmark[] | null {
  if (!raw) return [];
  if (raw.length > 4096) return null;
  try {
    const saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || Object.keys(saved).sort().join() !== "bookmarks,version" ||
      !Array.isArray(saved.bookmarks) || saved.bookmarks.length > reviewerGuides.length) return null;
    const guides = new Set<string>();
    for (const bookmark of saved.bookmarks) {
      if (!bookmark || typeof bookmark.guide !== "string" || typeof bookmark.chapter !== "string" ||
        Object.keys(bookmark).sort().join() !== "chapter,guide" || !bookmarkTarget(bookmark) || guides.has(bookmark.guide)) return null;
      guides.add(bookmark.guide);
    }
    return saved.bookmarks as ReviewerBookmark[];
  } catch { return null; }
}

export function toggleReviewerBookmark(bookmarks: ReviewerBookmark[], bookmark: ReviewerBookmark) {
  if (!bookmarkTarget(bookmark)) return bookmarks;
  const withoutGuide = bookmarks.filter(item => item.guide !== bookmark.guide);
  return bookmarks.some(item => item.guide === bookmark.guide && item.chapter === bookmark.chapter)
    ? withoutGuide : [bookmark, ...withoutGuide];
}
