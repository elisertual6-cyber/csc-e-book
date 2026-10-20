import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  digest,
  canReview,
  canWrite,
} from "../src/lib/security";
import { assertMutation } from "../src/lib/http";
describe("credential and role boundaries", () => {
  it("uses salted hashes and rejects wrong or unknown credentials", async () => {
    const first = await hashPassword("unique-long-test-password");
    const second = await hashPassword("unique-long-test-password");
    expect(first).not.toBe(second);
    expect(await verifyPassword("unique-long-test-password", first)).toBe(true);
    expect(await verifyPassword("a-different-long-password", first)).toBe(
      false,
    );
    expect(await verifyPassword("unique-long-test-password", null)).toBe(false);
    expect(digest("token")).not.toBe("token");
  }, 10000);
  it("separates editors, independent reviewers and customers", () => {
    expect(canWrite("CUSTOMER")).toBe(false);
    expect(canReview("CUSTOMER")).toBe(false);
    expect(canWrite("EDITOR")).toBe(true);
    expect(canReview("EDITOR")).toBe(false);
    expect(canReview("REVIEWER")).toBe(true);
    expect(canWrite("REVIEWER")).toBe(false);
  });
  it("requires the configured origin, JSON and a non-simple action header", () => {
    const previous = process.env.APP_URL;
    process.env.APP_URL = "https://reviewer.example";
    try {
      const request = (
        origin: string,
        action = "1",
        type = "application/json",
      ) =>
        new Request("https://reviewer.example/api/admin/lessons", {
          method: "POST",
          headers: {
            Origin: origin,
            "X-CSC-Action": action,
            "Content-Type": type,
          },
          body: "{}",
        });
      expect(() =>
        assertMutation(request("https://reviewer.example")),
      ).not.toThrow();
      expect(() => assertMutation(request("https://evil.example"))).toThrow();
      expect(() =>
        assertMutation(request("https://reviewer.example", "")),
      ).toThrow();
      expect(() =>
        assertMutation(request("https://reviewer.example", "1", "text/plain")),
      ).toThrow();
    } finally {
      if (previous === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previous;
    }
  });
});
