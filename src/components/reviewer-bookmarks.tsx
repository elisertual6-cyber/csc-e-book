"use client";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { bookmarkTarget, readReviewerBookmarks, reviewerBookmarkStorageKey, toggleReviewerBookmark, type ReviewerBookmark } from "@/lib/reviewer-bookmarks";

const changed = "csc-reviewer-bookmarks-changed";
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === reviewerBookmarkStorageKey || event.key === null) listener();
  };
  window.addEventListener(changed, listener);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener("storage", storage); };
}
function snapshot() {
  try { return localStorage.getItem(reviewerBookmarkStorageKey) ?? ""; }
  catch { return null; }
}
const serverSnapshot = () => undefined;
function useBookmarks() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return { raw, bookmarks: typeof raw === "string" ? readReviewerBookmarks(raw) : [] };
}
function persist(bookmarks: ReviewerBookmark[] | null) {
  try {
    if (bookmarks?.length) localStorage.setItem(reviewerBookmarkStorageKey, JSON.stringify({ version: 1, bookmarks }));
    else localStorage.removeItem(reviewerBookmarkStorageKey);
    window.dispatchEvent(new Event(changed));
    return true;
  } catch { return false; }
}
const unavailable = "Browser saving is unavailable. You can still read and print every guide.";

export function ReviewerBookmarkButton({ guide, chapter }: ReviewerBookmark) {
  const { raw, bookmarks } = useBookmarks();
  const [message, setMessage] = useState("");
  const target = bookmarkTarget({ guide, chapter });
  if (!target) return null;
  const saved = bookmarks?.some(item => item.guide === guide && item.chapter === chapter) ?? false;
  return <div className="reviewer-bookmark reviewer-screen-only">
    <button type="button" className="text-link" aria-label={`Bookmark chapter: ${target.title}`} aria-pressed={saved} disabled={raw === undefined || raw === null} onClick={() => {
      // Read at the click so another open tab's bookmark is not overwritten by stale UI state.
      const latest = snapshot();
      if (latest === null) { setMessage(unavailable); return; }
      const next = toggleReviewerBookmark(readReviewerBookmarks(latest) ?? [], { guide, chapter });
      setMessage(persist(next) ? "" : unavailable);
    }}>{saved ? "Bookmarked ✓" : "Bookmark chapter"}</button>
    <span role="status">{raw === null ? unavailable : message}</span>
  </div>;
}

export function ReviewerBookmarks({ guide }: { guide?: string }) {
  const { raw, bookmarks } = useBookmarks();
  const heading = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const visible = (bookmarks ?? []).filter(item => !guide || item.guide === guide);
  return <section className="reviewer-bookmarks reviewer-screen-only" aria-label="Saved reviewer chapters">
    <h2 ref={heading} tabIndex={-1}>Continue reading</h2>
    <p className="fine-print">Bookmark one chapter per guide. Saved only on this browser, shared by anyone using it. Avoid saving on a shared device. This does not mark lessons complete.</p>
    {raw === undefined ? <p role="status">Loading bookmarks…</p> : <>
      {visible.length > 0 ? <ul>{visible.map(bookmark => {
        const target = bookmarkTarget(bookmark)!;
        return <li key={bookmark.guide}><Link className="text-link" href={target.href}>{target.guideTitle}: {target.title} →</Link></li>;
      })}</ul> : raw !== null && bookmarks !== null && <p>No saved chapter{guide ? " in this guide" : "s"} yet. Use “Bookmark chapter” while reading.</p>}
      <p role="status">{raw === null ? unavailable : message || (bookmarks === null ? "Saved bookmarks could not be read. Save a chapter to replace them, or clear reviewer bookmarks." : "")}</p>
      {raw !== null && (bookmarks === null || bookmarks.length > 0) && <button type="button" className="text-link" onClick={() => {
        if (persist(null)) { setMessage(""); heading.current?.focus(); }
        else setMessage(unavailable);
      }}>Clear all reviewer bookmarks</button>}
    </>}
  </section>;
}
