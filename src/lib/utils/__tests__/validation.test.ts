import { describe, it, expect } from "vitest";
import { ensureArray, ensureStringArray, safeIncludes } from "../validation";

describe("validation utilities", () => {
  describe("ensureArray", () => {
    it("returns the same array when given an array", () => {
      const input = [1, 2, 3];
      expect(ensureArray(input)).toEqual([1, 2, 3]);
    });

    it("returns empty array for null", () => {
      expect(ensureArray(null)).toEqual([]);
    });

    it("returns empty array for undefined", () => {
      expect(ensureArray(undefined)).toEqual([]);
    });

    it("wraps single value in array", () => {
      expect(ensureArray("single")).toEqual(["single"]);
    });

    it("wraps number in array", () => {
      expect(ensureArray(42)).toEqual([42]);
    });

    it("wraps object in array", () => {
      const obj = { id: 1, name: "test" };
      expect(ensureArray(obj)).toEqual([obj]);
    });

    it("returns empty array for empty array input", () => {
      expect(ensureArray([])).toEqual([]);
    });

    it("handles array with mixed types", () => {
      const mixed = [1, "two", null, { three: 3 }];
      expect(ensureArray(mixed)).toEqual(mixed);
    });
  });

  describe("ensureStringArray", () => {
    it("returns string array unchanged", () => {
      const input = ["a", "b", "c"];
      expect(ensureStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("filters out null values", () => {
      const input = ["a", null, "b", null, "c"];
      expect(ensureStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("filters out undefined values", () => {
      const input = ["a", undefined, "b", undefined];
      expect(ensureStringArray(input)).toEqual(["a", "b"]);
    });

    it("filters out numbers", () => {
      const input = ["a", 1, "b", 2, "c"];
      expect(ensureStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("filters out objects", () => {
      const input = ["a", { id: 1 }, "b", [], "c"];
      expect(ensureStringArray(input)).toEqual(["a", "b", "c"]);
    });

    it("returns empty array for null input", () => {
      expect(ensureStringArray(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(ensureStringArray(undefined)).toEqual([]);
    });

    it("wraps single string in array", () => {
      expect(ensureStringArray("single")).toEqual(["single"]);
    });

    it("returns empty for single non-string", () => {
      expect(ensureStringArray(123)).toEqual([]);
    });

    it("handles empty string correctly", () => {
      expect(ensureStringArray(["", "a", ""])).toEqual(["", "a", ""]);
    });
  });

  describe("safeIncludes", () => {
    it("returns true when value is in array", () => {
      expect(safeIncludes([1, 2, 3], 2)).toBe(true);
    });

    it("returns false when value is not in array", () => {
      expect(safeIncludes([1, 2, 3], 4)).toBe(false);
    });

    it("returns false for null input", () => {
      expect(safeIncludes(null, "value")).toBe(false);
    });

    it("returns false for undefined input", () => {
      expect(safeIncludes(undefined, "value")).toBe(false);
    });

    it("returns false for non-array input (string)", () => {
      expect(safeIncludes("not-array", "a")).toBe(false);
    });

    it("returns false for non-array input (object)", () => {
      expect(safeIncludes({ includes: () => true }, "key")).toBe(false);
    });

    it("returns false for non-array input (number)", () => {
      expect(safeIncludes(123, 1)).toBe(false);
    });

    it("works with string arrays", () => {
      expect(safeIncludes(["a", "b", "c"], "b")).toBe(true);
      expect(safeIncludes(["a", "b", "c"], "d")).toBe(false);
    });

    it("works with empty array", () => {
      expect(safeIncludes([], "anything")).toBe(false);
    });

    it("handles object equality correctly (reference)", () => {
      const obj = { id: 1 };
      const arr = [obj, { id: 2 }];
      expect(safeIncludes(arr, obj)).toBe(true);
      expect(safeIncludes(arr, { id: 1 })).toBe(false); // Different reference
    });
  });
});
