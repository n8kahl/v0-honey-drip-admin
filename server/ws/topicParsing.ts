/**
 * WebSocket Topic Parsing Utilities
 *
 * Handles parsing of subscription topics from client messages.
 * Critical: Massive topics can contain commas (e.g., "options.bars:1m,5m,15m:SPY*")
 * so we cannot blindly split on commas.
 *
 * @module server/ws/topicParsing
 */

/**
 * Parse client params to an array of topics.
 *
 * Rules:
 * 1. If params is an array of strings -> trim each and keep non-empty
 * 2. If params is a string:
 *    - If it contains ":" -> treat as ONE topic (do not split on commas)
 *    - Otherwise split on commas
 * 3. Otherwise return empty array
 *
 * @example
 * // Array input - each element is a topic
 * parseClientParamsToTopics(["options.bars:1m,5m:SPY*"]) // ["options.bars:1m,5m:SPY*"]
 *
 * @example
 * // String with colon - single topic (don't split on commas)
 * parseClientParamsToTopics("options.bars:1m,5m:SPY*") // ["options.bars:1m,5m:SPY*"]
 *
 * @example
 * // String without colon - split on commas (legacy simple format)
 * parseClientParamsToTopics("A,B,C") // ["A", "B", "C"]
 *
 * @param params - The params field from a WebSocket message
 * @returns Array of topic strings
 */
export function parseClientParamsToTopics(params: unknown): string[] {
  // Case 1: Array of strings
  if (Array.isArray(params)) {
    return params
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Case 2: String
  if (typeof params === "string") {
    const trimmed = params.trim();
    if (!trimmed) return [];

    // If contains ":" -> it's a structured topic, don't split on commas
    // Massive topics look like: "options.bars:1m,5m,15m:SPY*,QQQ*"
    // or "indices.bars:1m,5m:I:SPX,I:NDX"
    if (trimmed.includes(":")) {
      return [trimmed];
    }

    // Legacy simple format without colons: "topic1,topic2,topic3"
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Case 3: Invalid type
  return [];
}

/**
 * Normalize an indices topic to use the I: prefix for symbols.
 *
 * Massive indices endpoint requires symbols in "I:SYMBOL" format.
 * Common mistake: sending "V.SPX" instead of "V.I:SPX"
 *
 * @example
 * normalizeIndicesTopic("V.SPX") // "V.I:SPX"
 * normalizeIndicesTopic("V.I:SPX") // "V.I:SPX" (already correct)
 * normalizeIndicesTopic("AM.NDX") // "AM.I:NDX"
 * normalizeIndicesTopic("options.bars:1m:SPY*") // "options.bars:1m:SPY*" (not indices)
 *
 * @param topic - The topic string to normalize
 * @returns Normalized topic string
 */
export function normalizeIndicesTopic(topic: string): string {
  // Pattern: ^(V|AM|A)\.(.+)$
  // V = value/quote, AM = aggregate minute, A = aggregate
  const match = topic.match(/^(V|AM|A)\.(.+)$/);
  if (!match) return topic;

  const eventType = match[1]; // V, AM, or A
  const symbol = match[2];

  // If symbol already starts with "I:", it's correct
  if (symbol.startsWith("I:")) {
    return topic;
  }

  // Add the I: prefix
  return `${eventType}.I:${symbol}`;
}

/**
 * Parse and normalize topics for the indices endpoint.
 *
 * Combines parseClientParamsToTopics with normalizeIndicesTopic.
 *
 * @param params - The params field from a WebSocket message
 * @returns Array of normalized topic strings for indices
 */
export function parseAndNormalizeIndicesTopics(params: unknown): string[] {
  const topics = parseClientParamsToTopics(params);
  return topics.map(normalizeIndicesTopic);
}
