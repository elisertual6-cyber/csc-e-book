import { describe, expect, it } from "vitest";
import { bookmarkTarget, readReviewerBookmarks, toggleReviewerBookmark } from "../src/lib/reviewer-bookmarks";
import { reviewerGuides } from "../src/lib/reviewer-catalog";

const first = { guide: "numerical-ability", chapter: "arithmetic" };
const second = { guide: "numerical-ability", chapter: "fractions" };
const verbal = { guide: "verbal-ability", chapter: "grammar" };
const encode = (bookmarks: unknown) => JSON.stringify({ version: 1, bookmarks });
describe("optional public reviewer bookmarks", () => {
  it("resolves all 29 public chapters through fixed metadata only", () => {
    let count = 0;
    for (const guide of reviewerGuides) for (const chapter of [...guide.lessons, "extra-practice"]) {
      const bookmark = { guide: guide.slug, chapter };
      expect(readReviewerBookmarks(encode([bookmark]))).toEqual([bookmark]);
      expect(bookmarkTarget(bookmark)?.href).toBe(`/reviewers/${guide.slug}#${chapter}`);
      count++;
    }
    expect(count).toBe(29);
  });
  it("replaces only the same guide, keeps most recent first, and toggles off", () => {
    const original = [first, verbal];
    const next = toggleReviewerBookmark(original, second);
    expect(next).toEqual([second, verbal]);
    expect(original).toEqual([first, verbal]);
    expect(toggleReviewerBookmark(next, second)).toEqual([verbal]);
    expect(toggleReviewerBookmark(next, { guide: "bad", chapter: "bad" })).toEqual(next);
    expect(readReviewerBookmarks("")).toEqual([]);
  });
  it("rejects corrupt, oversized, duplicate, private, mismatched and arbitrary-link references", () => {
    const invalid = [
      "broken", "null", "[]", "x".repeat(4097),
      JSON.stringify({ version: 2, bookmarks: [first] }),
      JSON.stringify({ version: 1, bookmarks: [first], token: "untrusted" }),
      encode([first, second]), encode([first, first]), encode(Array(7).fill(first)),
      encode([null]), encode([{ guide: 1, chapter: "arithmetic" }]),
      encode([{ ...first, href: "https://example.invalid/" }]),
      encode([{ guide: "numerical-ability", chapter: "grammar" }]),
      encode([{ guide: "series-2-core", chapter: "question-1" }]),
      encode([{ guide: "javascript:alert(1)", chapter: "extra-practice" }]),
      encode([{ guide: "../../content/questions", chapter: "arithmetic" }]),
    ];
    for (const raw of invalid) expect(readReviewerBookmarks(raw)).toBeNull();
  });
});
