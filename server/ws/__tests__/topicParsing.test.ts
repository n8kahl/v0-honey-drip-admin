/**
 * Topic Parsing Tests
 *
 * Tests for WebSocket topic parsing utilities.
 * Critical: Ensures topics with commas (like "options.bars:1m,5m:SPY*")
 * are not incorrectly split.
 */

import { describe, it, expect } from "vitest";
import {
  parseClientParamsToTopics,
  normalizeIndicesTopic,
  parseAndNormalizeIndicesTopics,
} from "../topicParsing";

// ============================================================================
// parseClientParamsToTopics Tests
// ============================================================================

describe("parseClientParamsToTopics", () => {
  describe("Array input", () => {
    it("Test A: returns array elements as-is (single structured topic)", () => {
      // Critical test: This is exactly what the client sends for options bars
      const result = parseClientParamsToTopics(["options.bars:1m,5m:SPY*"]);
      expect(result).toEqual(["options.bars:1m,5m:SPY*"]);
    });

    it("handles multiple topics in array", () => {
      const result = parseClientParamsToTopics([
        "options.bars:1m,5m,15m:SPY*",
        "options.trades:SPY*",
        "options.quotes:SPY*",
      ]);
      expect(result).toEqual([
        "options.bars:1m,5m,15m:SPY*",
        "options.trades:SPY*",
        "options.quotes:SPY*",
      ]);
    });

    it("trims whitespace from array elements", () => {
      const result = parseClientParamsToTopics(["  topic1  ", " topic2 "]);
      expect(result).toEqual(["topic1", "topic2"]);
    });

    it("filters out empty strings from array", () => {
      const result = parseClientParamsToTopics(["topic1", "", "  ", "topic2"]);
      expect(result).toEqual(["topic1", "topic2"]);
    });

    it("filters out non-string elements from array", () => {
      const result = parseClientParamsToTopics(["topic1", 123, null, undefined, "topic2"] as any);
      expect(result).toEqual(["topic1", "topic2"]);
    });
  });

  describe("String input with colon (structured topic)", () => {
    it("Test B: treats string with colon as single topic (no comma split)", () => {
      // This was the BUG: "options.bars:1m,5m:SPY*" was being split on commas
      const result = parseClientParamsToTopics("options.bars:1m,5m:SPY*");
      expect(result).toEqual(["options.bars:1m,5m:SPY*"]);
    });

    it("handles indices topic with multiple symbols", () => {
      const result = parseClientParamsToTopics("indices.bars:1m,5m,15m,60m:I:SPX,I:NDX,I:VIX");
      expect(result).toEqual(["indices.bars:1m,5m,15m,60m:I:SPX,I:NDX,I:VIX"]);
    });

    it("handles simple colon format", () => {
      const result = parseClientParamsToTopics("V.I:SPX");
      expect(result).toEqual(["V.I:SPX"]);
    });
  });

  describe("String input without colon (legacy simple format)", () => {
    it("Test C: splits comma-separated simple topics", () => {
      const result = parseClientParamsToTopics("A,B,C");
      expect(result).toEqual(["A", "B", "C"]);
    });

    it("trims whitespace from comma-separated values", () => {
      const result = parseClientParamsToTopics(" A , B , C ");
      expect(result).toEqual(["A", "B", "C"]);
    });

    it("filters empty segments from comma-separated string", () => {
      const result = parseClientParamsToTopics("A,,B,  ,C");
      expect(result).toEqual(["A", "B", "C"]);
    });

    it("handles single topic without colon", () => {
      const result = parseClientParamsToTopics("simple-topic");
      expect(result).toEqual(["simple-topic"]);
    });
  });

  describe("Edge cases", () => {
    it("returns empty array for empty string", () => {
      expect(parseClientParamsToTopics("")).toEqual([]);
    });

    it("returns empty array for whitespace-only string", () => {
      expect(parseClientParamsToTopics("   ")).toEqual([]);
    });

    it("returns empty array for null", () => {
      expect(parseClientParamsToTopics(null)).toEqual([]);
    });

    it("returns empty array for undefined", () => {
      expect(parseClientParamsToTopics(undefined)).toEqual([]);
    });

    it("returns empty array for number", () => {
      expect(parseClientParamsToTopics(123)).toEqual([]);
    });

    it("returns empty array for object", () => {
      expect(parseClientParamsToTopics({ topic: "test" })).toEqual([]);
    });

    it("returns empty array for empty array", () => {
      expect(parseClientParamsToTopics([])).toEqual([]);
    });
  });
});

// ============================================================================
// normalizeIndicesTopic Tests
// ============================================================================

describe("normalizeIndicesTopic", () => {
  it("Test D: normalizes V.SPX to V.I:SPX", () => {
    expect(normalizeIndicesTopic("V.SPX")).toBe("V.I:SPX");
  });

  it("normalizes AM.NDX to AM.I:NDX", () => {
    expect(normalizeIndicesTopic("AM.NDX")).toBe("AM.I:NDX");
  });

  it("normalizes A.VIX to A.I:VIX", () => {
    expect(normalizeIndicesTopic("A.VIX")).toBe("A.I:VIX");
  });

  it("preserves already-normalized topics (V.I:SPX)", () => {
    expect(normalizeIndicesTopic("V.I:SPX")).toBe("V.I:SPX");
  });

  it("preserves already-normalized topics (AM.I:NDX)", () => {
    expect(normalizeIndicesTopic("AM.I:NDX")).toBe("AM.I:NDX");
  });

  it("does not modify non-matching topics", () => {
    expect(normalizeIndicesTopic("options.bars:1m:SPY*")).toBe("options.bars:1m:SPY*");
  });

  it("does not modify simple topics", () => {
    expect(normalizeIndicesTopic("random-topic")).toBe("random-topic");
  });

  it("handles edge case of empty string", () => {
    expect(normalizeIndicesTopic("")).toBe("");
  });
});

// ============================================================================
// parseAndNormalizeIndicesTopics Tests
// ============================================================================

describe("parseAndNormalizeIndicesTopics", () => {
  it("parses and normalizes array of indices topics", () => {
    const result = parseAndNormalizeIndicesTopics(["V.SPX", "AM.NDX"]);
    expect(result).toEqual(["V.I:SPX", "AM.I:NDX"]);
  });

  it("parses and normalizes string indices topic", () => {
    const result = parseAndNormalizeIndicesTopics("V.SPX");
    expect(result).toEqual(["V.I:SPX"]);
  });

  it("parses comma-separated simple indices topics", () => {
    const result = parseAndNormalizeIndicesTopics("V.SPX,AM.NDX,A.VIX");
    expect(result).toEqual(["V.I:SPX", "AM.I:NDX", "A.I:VIX"]);
  });

  it("preserves structured topic with colon (no normalization needed)", () => {
    const result = parseAndNormalizeIndicesTopics("indices.bars:1m,5m:I:SPX,I:NDX");
    expect(result).toEqual(["indices.bars:1m,5m:I:SPX,I:NDX"]);
  });
});

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

describe("Real-world scenarios", () => {
  describe("Options subscription (buildOptionsChannels output)", () => {
    it("handles typical options bars subscription", () => {
      // This is what buildOptionsChannels produces
      const channels = [
        "options.bars:1m,5m,15m,60m:SPY*,QQQ*",
        "options.trades:SPY*,QQQ*",
        "options.quotes:SPY*,QQQ*",
      ];

      // Client sends as array
      const result = parseClientParamsToTopics(channels);
      expect(result).toEqual(channels);
      expect(result).toHaveLength(3);

      // Each channel should be preserved intact (not split on commas)
      expect(result[0]).toBe("options.bars:1m,5m,15m,60m:SPY*,QQQ*");
    });

    it("handles legacy string format (for backward compatibility)", () => {
      // Old code might send joined string for simple topics
      const legacyParams = "options.bars:1m,5m,15m,60m:SPY*,QQQ*";
      const result = parseClientParamsToTopics(legacyParams);

      // Should still be treated as single topic (has colon)
      expect(result).toEqual(["options.bars:1m,5m,15m,60m:SPY*,QQQ*"]);
    });
  });

  describe("Indices subscription", () => {
    it("handles indices bars subscription array", () => {
      const channels = ["indices.bars:1m,5m,15m,60m:I:SPX,I:NDX,I:VIX,I:RVX"];
      const result = parseClientParamsToTopics(channels);

      expect(result).toEqual(channels);
      expect(result).toHaveLength(1);
    });

    it("handles indices subscription with normalization", () => {
      const result = parseAndNormalizeIndicesTopics(["V.SPX", "V.NDX"]);
      expect(result).toEqual(["V.I:SPX", "V.I:NDX"]);
    });
  });

  describe("Unsubscribe scenarios", () => {
    it("handles unsubscribe with array params", () => {
      const oldChannels = [
        "options.bars:1m,5m,15m,60m:SPY*",
        "options.trades:SPY*",
        "options.quotes:SPY*",
      ];
      const result = parseClientParamsToTopics(oldChannels);

      expect(result).toEqual(oldChannels);
    });
  });
});
