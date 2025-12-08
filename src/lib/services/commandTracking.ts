/**
 * Command Tracking Service
 * Tracks voice commands (successful and failed) for analytics and learning
 */

export interface TrackedCommand {
  userId: string;
  command: string;
  rawTranscript: string;
  parsedType: string;
  wasHandled: boolean;
  timestamp: Date;
  error?: string;
}

const STORAGE_KEY = "voice_command_history";
const MAX_HISTORY_SIZE = 1000;

/**
 * Track a voice command for analytics
 */
export function trackCommand(command: TrackedCommand): void {
  try {
    const history = getCommandHistory();
    history.push({
      ...command,
      timestamp: new Date(),
    });

    // Keep only recent commands
    const trimmed = history.slice(-MAX_HISTORY_SIZE);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    console.warn("[v0] Tracked command:", command.parsedType, command.wasHandled ? "✓" : "✗");
  } catch (error) {
    console.error("[v0] Failed to track command:", error);
  }
}

/**
 * Get command history from localStorage
 */
export function getCommandHistory(): TrackedCommand[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("[v0] Failed to load command history:", error);
    return [];
  }
}

/**
 * Get failed/unsupported commands for learning
 */
export function getUnsupportedCommands(): TrackedCommand[] {
  const history = getCommandHistory();
  return history.filter((cmd) => !cmd.wasHandled || cmd.parsedType === "unknown");
}

/**
 * Get most frequently used commands
 */
export function getTopCommands(limit = 10): { command: string; count: number }[] {
  const history = getCommandHistory();
  const counts = new Map<string, number>();

  history.forEach((cmd) => {
    if (cmd.wasHandled) {
      const count = counts.get(cmd.parsedType) || 0;
      counts.set(cmd.parsedType, count + 1);
    }
  });

  return Array.from(counts.entries())
    .map(([command, count]) => ({ command, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Clear command history
 */
export function clearCommandHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.warn("[v0] Command history cleared");
  } catch (error) {
    console.error("[v0] Failed to clear command history:", error);
  }
}
