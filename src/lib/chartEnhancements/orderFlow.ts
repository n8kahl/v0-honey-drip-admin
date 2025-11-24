/**
 * Order Flow Context - Identify high volume clusters and volatility zones
 * Helps traders understand where the most activity occurred
 */

import type { Bar } from "../indicators";

export interface OrderFlowCluster {
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  avgPrice: number;
  totalVolume: number;
  volatility: number; // Range / Close
  strength: "high" | "medium" | "low"; // Based on volume and volatility
}

/**
 * Detect high volume clusters in bars
 * Identifies consecutive bars with above-average volume
 * @param bars - Array of OHLCV bars
 * @returns Array of order flow clusters
 */
export function detectOrderFlowClusters(bars: Bar[]): OrderFlowCluster[] {
  if (bars.length < 2) return [];

  // Calculate average volume
  const avgVolume = bars.reduce((sum, b) => sum + b.volume, 0) / bars.length;
  const volumeThreshold = avgVolume * 1.5; // 50% above average

  const clusters: OrderFlowCluster[] = [];
  let currentCluster: Bar[] | null = null;
  let clusterStartIdx = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];

    if (bar.volume >= volumeThreshold) {
      if (!currentCluster) {
        currentCluster = [];
        clusterStartIdx = i;
      }
      currentCluster.push(bar);
    } else {
      if (currentCluster && currentCluster.length >= 2) {
        // Save completed cluster
        clusters.push(createCluster(currentCluster, clusterStartIdx, i - 1, bars));
      }
      currentCluster = null;
    }
  }

  // Don't forget the last cluster if it exists
  if (currentCluster && currentCluster.length >= 2) {
    clusters.push(createCluster(currentCluster, clusterStartIdx, bars.length - 1, bars));
  }

  return clusters;
}

/**
 * Create a cluster from bars
 */
function createCluster(
  clusterBars: Bar[],
  startIdx: number,
  endIdx: number,
  allBars: Bar[]
): OrderFlowCluster {
  const totalVolume = clusterBars.reduce((sum, b) => sum + b.volume, 0);
  const avgPrice = clusterBars.reduce((sum, b) => sum + b.close, 0) / clusterBars.length;

  const highPrice = Math.max(...clusterBars.map((b) => b.high));
  const lowPrice = Math.min(...clusterBars.map((b) => b.low));
  const closePrice = clusterBars[clusterBars.length - 1].close;
  const volatility = (highPrice - lowPrice) / Math.max(closePrice, 0.0001);

  // Determine strength based on volume and volatility
  const volumeStrength = totalVolume / (clusterBars.length * clusterBars[0].volume);
  const volatilityStrength = volatility > 0.005 ? 1.5 : 1;
  const compositeStrength = volumeStrength * volatilityStrength;

  let strength: "high" | "medium" | "low";
  if (compositeStrength > 3) strength = "high";
  else if (compositeStrength > 1.5) strength = "medium";
  else strength = "low";

  return {
    startIndex: startIdx,
    endIndex: endIdx,
    startTime: allBars[startIdx].time as number,
    endTime: allBars[endIdx].time as number,
    avgPrice,
    totalVolume,
    volatility,
    strength,
  };
}

/**
 * Get visual color for cluster strength
 */
export function getClusterColor(strength: "high" | "medium" | "low"): string {
  switch (strength) {
    case "high":
      return "rgba(239, 68, 68, 0.15)"; // Red with transparency
    case "medium":
      return "rgba(251, 146, 60, 0.15)"; // Orange with transparency
    case "low":
      return "rgba(100, 116, 139, 0.1)"; // Gray with low transparency
  }
}
