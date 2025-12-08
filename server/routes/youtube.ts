/**
 * YouTube API Routes
 * Fetches Brett Corrigan pre-market analysis videos
 */

import express, { Request, Response } from "express";

const router = express.Router();

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BRETT_CORRIGAN_CHANNEL_ID = "UCxQvbPFP_Y9ggZUfFO1F_Ug"; // Replace with actual channel ID
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CachedVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  cachedAt: number;
}

let videoCache: CachedVideo | null = null;

/**
 * GET /api/youtube/latest-premarket
 * Returns the most recent pre-market video from Brett Corrigan
 */
router.get("/latest-premarket", async (req: Request, res: Response) => {
  try {
    // Return cached result if fresh
    if (videoCache && Date.now() - videoCache.cachedAt < CACHE_DURATION_MS) {
      return res.json({
        available: true,
        ...videoCache,
      });
    }

    // Check if API key is configured
    if (!YOUTUBE_API_KEY) {
      console.warn("[v0] YouTube: API key not configured");
      return res.json({ available: false, reason: "API key not configured" });
    }

    // Calculate time window (last 18 hours for daily video)
    const eighteenHoursAgo = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();

    // Search for pre-market videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("channelId", BRETT_CORRIGAN_CHANNEL_ID);
    searchUrl.searchParams.set("q", "pre-market OR premarket");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", "date");
    searchUrl.searchParams.set("publishedAfter", eighteenHoursAgo);
    searchUrl.searchParams.set("maxResults", "1");
    searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

    const response = await fetch(searchUrl.toString());

    if (!response.ok) {
      console.error("[v0] YouTube: API error", response.status, response.statusText);
      return res.json({ available: false, reason: "API error" });
    }

    const data = await response.json();

    // Check if video found
    if (!data.items || data.items.length === 0) {
      return res.json({ available: false, reason: "No recent video" });
    }

    const video = data.items[0];
    const result: CachedVideo = {
      videoId: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
      publishedAt: video.snippet.publishedAt,
      cachedAt: Date.now(),
    };

    // Cache result
    videoCache = result;

    return res.json({
      available: true,
      ...result,
    });
  } catch (error) {
    console.error("[v0] YouTube: Error fetching pre-market video:", error);
    return res.status(500).json({
      available: false,
      reason: "Server error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
