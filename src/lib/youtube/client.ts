/**
 * YouTube API Client
 * Fetches Brett Corrigan pre-market analysis videos via backend proxy
 */

export interface PremarketVideo {
  available: boolean;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  publishedAt?: string;
  reason?: string;
}

/**
 * Fetch the latest pre-market video from Brett Corrigan
 */
export async function fetchLatestPremarket(): Promise<PremarketVideo> {
  try {
    const response = await fetch("/api/youtube/latest-premarket");

    if (!response.ok) {
      console.error("[v0] YouTube client: API error", response.status);
      return { available: false, reason: "API error" };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[v0] YouTube client: Network error:", error);
    return { available: false, reason: "Network error" };
  }
}

/**
 * Get YouTube embed URL for a video ID
 */
export function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

/**
 * Get YouTube watch URL for a video ID
 */
export function getWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Format published date as relative time
 */
export function formatPublishedDate(publishedAt: string): string {
  const published = new Date(publishedAt);
  const now = new Date();
  const diffMs = now.getTime() - published.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffHours < 1) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  }

  return published.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
