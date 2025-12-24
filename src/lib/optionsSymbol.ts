export function normalizeOptionTicker(ticker?: string | null): string | null {
  if (!ticker) return null;
  const trimmed = ticker.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s+/g, "");
  const upper = compact.toUpperCase();

  if (upper.startsWith("O:")) return upper;

  const occPattern = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;
  if (occPattern.test(upper)) return `O:${upper}`;

  return upper;
}
