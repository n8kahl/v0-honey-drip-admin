/**
 * Validation utilities for ensuring data type safety
 * These helpers prevent runtime crashes from unexpected data types
 */

/**
 * Ensures a value is always an array
 * Handles null, undefined, single values, and already-arrays
 *
 * @example
 * ensureArray([1, 2, 3]) // [1, 2, 3]
 * ensureArray(null) // []
 * ensureArray(undefined) // []
 * ensureArray("single") // ["single"]
 */
export function ensureArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

/**
 * Ensures a value is a valid string array (filters out non-strings)
 *
 * @example
 * ensureStringArray(["a", "b", null, "c"]) // ["a", "b", "c"]
 * ensureStringArray(null) // []
 */
export function ensureStringArray(value: any): string[] {
  const arr = ensureArray(value);
  return arr.filter((item): item is string => typeof item === 'string');
}

/**
 * Safely checks if an array includes a value
 * Returns false if the array is invalid
 *
 * @example
 * safeIncludes([1, 2, 3], 2) // true
 * safeIncludes(null, 2) // false
 * safeIncludes("not-array", 2) // false
 */
export function safeIncludes<T>(arr: T[] | any, value: T): boolean {
  if (!Array.isArray(arr)) return false;
  return arr.includes(value);
}
