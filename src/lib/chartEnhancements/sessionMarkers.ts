/**
 * Session Markers - Visual indicators for different market sessions
 * Shows pre-market (4 AM - 9:30 AM), regular hours (9:30 AM - 4 PM), after-hours (4 PM - 8 PM)
 */

export interface SessionMarker {
  startTime: number; // Unix timestamp (seconds)
  endTime: number;
  name: "pre-market" | "regular" | "after-hours";
  color: string;
}

/**
 * Get the Eastern Time zone offset (handles EST/EDT)
 */
function getEasternOffset(): number {
  const now = new Date();
  // Create a date string in ET
  const etDate = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  // Offset in milliseconds
  const offset = now.getTime() - etDate.getTime();
  return offset / 3600000; // Convert to hours
}

/**
 * Convert a local time (HH:MM in ET) to Unix timestamp for a given date
 */
function getETTimestamp(dateStr: string, timeStr: string): number {
  // Parse date and time in ET
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);

  // Create date in ET
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  // Adjust for timezone difference
  const offset = getEasternOffset();
  const adjusted = new Date(date.getTime() - offset * 3600000);

  return Math.floor(adjusted.getTime() / 1000); // Return as Unix timestamp (seconds)
}

/**
 * Get session markers for a trading day
 * Returns visual regions for pre-market, regular hours, and after-hours
 */
export function getSessionMarkersForDate(dateStr: string): SessionMarker[] {
  return [
    {
      startTime: getETTimestamp(dateStr, "04:00"),
      endTime: getETTimestamp(dateStr, "09:30"),
      name: "pre-market",
      color: "rgba(100, 116, 139, 0.08)", // Slate gray, very light
    },
    {
      startTime: getETTimestamp(dateStr, "09:30"),
      endTime: getETTimestamp(dateStr, "16:00"),
      name: "regular",
      color: "rgba(255, 255, 255, 0)", // No color for regular hours
    },
    {
      startTime: getETTimestamp(dateStr, "16:00"),
      endTime: getETTimestamp(dateStr, "20:00"),
      name: "after-hours",
      color: "rgba(100, 116, 139, 0.08)", // Slate gray, very light
    },
  ];
}

/**
 * Get session markers for bars (auto-detect dates from bar timestamps)
 */
export function getSessionMarkersForBars(barTimes: number[]): SessionMarker[] {
  if (barTimes.length === 0) return [];

  const uniqueDates = new Set<string>();

  // Extract unique dates from bar timestamps
  for (const timestamp of barTimes) {
    const date = new Date(timestamp * 1000);
    const dateStr = date.toISOString().split("T")[0];
    uniqueDates.add(dateStr);
  }

  // Get markers for each date
  const allMarkers: SessionMarker[] = [];
  for (const dateStr of Array.from(uniqueDates).sort()) {
    allMarkers.push(...getSessionMarkersForDate(dateStr));
  }

  return allMarkers;
}

/**
 * Get the name of the current session
 */
export function getCurrentSession(): "pre-market" | "regular" | "after-hours" {
  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const preMarketEnd = 9 * 60 + 30; // 9:30 AM
  const regularEnd = 16 * 60; // 4:00 PM
  const afterHoursEnd = 20 * 60; // 8:00 PM

  if (totalMinutes < preMarketEnd) return "pre-market";
  if (totalMinutes < regularEnd) return "regular";
  if (totalMinutes < afterHoursEnd) return "after-hours";
  return "pre-market"; // Night time before next day's pre-market
}

/**
 * Check if a timestamp is in a specific session
 */
export function isInSession(
  timestamp: number,
  session: "pre-market" | "regular" | "after-hours"
): boolean {
  const date = new Date(timestamp * 1000);
  const dateStr = date.toISOString().split("T")[0];
  const markers = getSessionMarkersForDate(dateStr);

  for (const marker of markers) {
    if (marker.name === session && timestamp >= marker.startTime && timestamp <= marker.endTime) {
      return true;
    }
  }

  return false;
}
