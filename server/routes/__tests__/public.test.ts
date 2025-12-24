/**
 * Public API Endpoint Tests
 *
 * Tests for the public-facing API endpoints.
 * These tests verify:
 * 1. Response shapes match expected format
 * 2. Date boundary calculations are correct
 * 3. Trade grouping and filtering logic
 * 4. Stats calculations with edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculatePnlPercent,
  calculateProgressToTarget,
  getTimeElapsed,
  getBestPrice,
  ACTIVE_TRADE_STATES,
  EXITED_TRADE_STATES,
} from "../../lib/publicCalculations.js";

// ============================================================================
// Mock Trade Data
// ============================================================================

interface MockPublicTrade {
  id: string;
  ticker: string;
  trade_type: "Scalp" | "Day" | "Swing" | "LEAP";
  state: string;
  entry_price: number | null;
  current_price: number | null;
  exit_price: number | null;
  target_price: number | null;
  stop_loss: number | null;
  entry_time: string | null;
  exit_time: string | null;
  created_at: string;
  show_on_public: boolean;
  admin_name: string;
  contract: { strike: number; type: "C" | "P"; expiry: string } | null;
}

const mockTrades: MockPublicTrade[] = [
  {
    id: "trade-1",
    ticker: "SPY",
    trade_type: "Scalp",
    state: "ENTERED",
    entry_price: 100,
    current_price: 120,
    exit_price: null,
    target_price: 150,
    stop_loss: 90,
    entry_time: "2025-01-15T10:00:00Z",
    exit_time: null,
    created_at: "2025-01-15T09:30:00Z",
    show_on_public: true,
    admin_name: "Admin A",
    contract: { strike: 595, type: "C", expiry: "2025-01-17" },
  },
  {
    id: "trade-2",
    ticker: "QQQ",
    trade_type: "Day",
    state: "LOADED",
    entry_price: null,
    current_price: null,
    exit_price: null,
    target_price: 200,
    stop_loss: 180,
    entry_time: null,
    exit_time: null,
    created_at: "2025-01-15T09:00:00Z",
    show_on_public: true,
    admin_name: "Admin B",
    contract: { strike: 520, type: "P", expiry: "2025-01-17" },
  },
  {
    id: "trade-3",
    ticker: "AAPL",
    trade_type: "Swing",
    state: "EXITED",
    entry_price: 50,
    current_price: 75,
    exit_price: 75,
    target_price: 100,
    stop_loss: 40,
    entry_time: "2025-01-10T10:00:00Z",
    exit_time: "2025-01-15T14:00:00Z",
    created_at: "2025-01-10T09:30:00Z",
    show_on_public: true,
    admin_name: "Admin A",
    contract: { strike: 230, type: "C", expiry: "2025-01-20" },
  },
  {
    id: "trade-4",
    ticker: "TSLA",
    trade_type: "Scalp",
    state: "EXITED",
    entry_price: 100,
    current_price: 80,
    exit_price: 80,
    target_price: 150,
    stop_loss: 90,
    entry_time: "2025-01-15T11:00:00Z",
    exit_time: "2025-01-15T12:00:00Z",
    created_at: "2025-01-15T10:30:00Z",
    show_on_public: true,
    admin_name: "Admin B",
    contract: { strike: 400, type: "P", expiry: "2025-01-17" },
  },
  // Private trade (should be filtered out)
  {
    id: "trade-5",
    ticker: "NVDA",
    trade_type: "Day",
    state: "ENTERED",
    entry_price: 100,
    current_price: 110,
    exit_price: null,
    target_price: 120,
    stop_loss: 95,
    entry_time: "2025-01-15T10:00:00Z",
    exit_time: null,
    created_at: "2025-01-15T09:30:00Z",
    show_on_public: false, // Not public
    admin_name: "Admin C",
    contract: null,
  },
];

// ============================================================================
// Helper Functions (simulating route logic)
// ============================================================================

/**
 * Filter active trades (LOADED, ENTERED)
 */
function getActiveTrades(trades: MockPublicTrade[]): MockPublicTrade[] {
  return trades.filter(
    (t) =>
      t.show_on_public &&
      ((ACTIVE_TRADE_STATES as readonly string[]).includes(t.state.toUpperCase()) ||
        (ACTIVE_TRADE_STATES as readonly string[]).includes(t.state.toLowerCase()))
  );
}

/**
 * Filter exited trades
 */
function getExitedTrades(trades: MockPublicTrade[]): MockPublicTrade[] {
  return trades.filter(
    (t) =>
      t.show_on_public &&
      ((EXITED_TRADE_STATES as readonly string[]).includes(t.state.toUpperCase()) ||
        (EXITED_TRADE_STATES as readonly string[]).includes(t.state.toLowerCase()))
  );
}

/**
 * Group trades by type
 */
function groupTradesByType(trades: MockPublicTrade[]) {
  return {
    scalps: trades.filter((t) => t.trade_type === "Scalp"),
    day_trades: trades.filter((t) => t.trade_type === "Day"),
    swings: trades.filter((t) => t.trade_type === "Swing"),
    leaps: trades.filter((t) => t.trade_type === "LEAP"),
  };
}

/**
 * Enrich trade with computed fields
 */
function enrichTrade(trade: MockPublicTrade) {
  return {
    ...trade,
    pnl_percent: calculatePnlPercent(trade.entry_price, trade.current_price ?? trade.exit_price),
    time_in_trade: getTimeElapsed(trade.entry_time ?? trade.created_at),
    progress_to_target: calculateProgressToTarget(
      trade.entry_price,
      trade.current_price,
      trade.target_price
    ),
  };
}

/**
 * Calculate stats summary
 */
function calculateStatsSummary(
  trades: MockPublicTrade[],
  range: "day" | "week" | "month",
  now: Date
) {
  let startDate: Date;

  switch (range) {
    case "day":
      startDate = new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const exitedInRange = trades.filter((t) => {
    if (!t.exit_time) return false;
    const exitDate = new Date(t.exit_time);
    return exitDate >= startDate && exitDate <= now;
  });

  const stats = {
    range,
    start_date: startDate.toISOString(),
    end_date: now.toISOString(),
    total_trades: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
    total_pnl_percent: 0,
    avg_pnl_percent: 0,
    best_trade: { percent: 0, id: null as string | null },
    worst_trade: { percent: 0, id: null as string | null },
    by_type: {
      Scalp: { count: 0, wins: 0, losses: 0, total_pnl: 0 },
      Day: { count: 0, wins: 0, losses: 0, total_pnl: 0 },
      Swing: { count: 0, wins: 0, losses: 0, total_pnl: 0 },
      LEAP: { count: 0, wins: 0, losses: 0, total_pnl: 0 },
    } as Record<string, { count: number; wins: number; losses: number; total_pnl: number }>,
  };

  exitedInRange.forEach((trade) => {
    const pnl = calculatePnlPercent(trade.entry_price, trade.exit_price);
    if (pnl === null) return;

    stats.total_trades++;
    stats.total_pnl_percent += pnl;

    if (pnl > 0) stats.wins++;
    else if (pnl < 0) stats.losses++;

    if (pnl > stats.best_trade.percent) {
      stats.best_trade = { percent: pnl, id: trade.id };
    }
    if (pnl < stats.worst_trade.percent) {
      stats.worst_trade = { percent: pnl, id: trade.id };
    }

    const type = trade.trade_type;
    if (stats.by_type[type]) {
      stats.by_type[type].count++;
      stats.by_type[type].total_pnl += pnl;
      if (pnl > 0) stats.by_type[type].wins++;
      else if (pnl < 0) stats.by_type[type].losses++;
    }
  });

  if (stats.total_trades > 0) {
    stats.win_rate = (stats.wins / stats.total_trades) * 100;
    stats.avg_pnl_percent = stats.total_pnl_percent / stats.total_trades;
  }

  return stats;
}

// ============================================================================
// GET /api/public/trades/active Tests
// ============================================================================

describe("GET /api/public/trades/active", () => {
  describe("Trade Filtering", () => {
    it("filters to only show_on_public=true trades", () => {
      const publicTrades = mockTrades.filter((t) => t.show_on_public);
      expect(publicTrades.length).toBe(4);
      expect(publicTrades.find((t) => t.id === "trade-5")).toBeUndefined();
    });

    it("filters to active states (LOADED, ENTERED)", () => {
      const activeTrades = getActiveTrades(mockTrades);
      // trade-1 (ENTERED), trade-2 (LOADED) are active and public
      expect(activeTrades.length).toBe(2);
      expect(activeTrades.map((t) => t.id)).toContain("trade-1");
      expect(activeTrades.map((t) => t.id)).toContain("trade-2");
    });

    it("excludes EXITED trades", () => {
      const activeTrades = getActiveTrades(mockTrades);
      expect(activeTrades.find((t) => t.state === "EXITED")).toBeUndefined();
    });
  });

  describe("Trade Grouping", () => {
    it("groups trades by type correctly", () => {
      const activeTrades = getActiveTrades(mockTrades);
      const grouped = groupTradesByType(activeTrades);

      expect(grouped.scalps.length).toBe(1); // trade-1
      expect(grouped.day_trades.length).toBe(1); // trade-2
      expect(grouped.swings.length).toBe(0);
      expect(grouped.leaps.length).toBe(0);
    });
  });

  describe("Trade Enrichment", () => {
    it("calculates pnl_percent for entered trades", () => {
      const trade = mockTrades.find((t) => t.id === "trade-1")!;
      const enriched = enrichTrade(trade);
      // entry=100, current=120 -> 20% gain
      expect(enriched.pnl_percent).toBe(20);
    });

    it("returns null pnl_percent for loaded trades with no entry", () => {
      const trade = mockTrades.find((t) => t.id === "trade-2")!;
      const enriched = enrichTrade(trade);
      expect(enriched.pnl_percent).toBeNull();
    });

    it("calculates progress_to_target", () => {
      const trade = mockTrades.find((t) => t.id === "trade-1")!;
      const enriched = enrichTrade(trade);
      // entry=100, current=120, target=150 -> 40% progress
      expect(enriched.progress_to_target).toBe(40);
    });
  });

  describe("Response Shape", () => {
    it("returns correct structure", () => {
      const activeTrades = getActiveTrades(mockTrades);
      const enrichedTrades = activeTrades.map(enrichTrade);
      const grouped = groupTradesByType(enrichedTrades);

      const response = {
        trades: enrichedTrades,
        grouped,
        total: enrichedTrades.length,
        by_state: {
          loaded: enrichedTrades.filter((t) => t.state === "LOADED").length,
          entered: enrichedTrades.filter((t) => t.state === "ENTERED").length,
        },
      };

      expect(response).toHaveProperty("trades");
      expect(response).toHaveProperty("grouped");
      expect(response).toHaveProperty("total");
      expect(response).toHaveProperty("by_state");
      expect(response.by_state).toHaveProperty("loaded");
      expect(response.by_state).toHaveProperty("entered");
    });
  });
});

// ============================================================================
// GET /api/public/stats/summary Tests
// ============================================================================

describe("GET /api/public/stats/summary", () => {
  beforeEach(() => {
    // Fix time for predictable tests
    vi.setSystemTime(new Date("2025-01-15T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Date Boundary Calculations", () => {
    it("day range starts at UTC midnight", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      expect(stats.start_date).toBe("2025-01-15T00:00:00.000Z");
    });

    it("week range is rolling 7 days", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "week", now);

      const expectedStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      expect(new Date(stats.start_date).getTime()).toBe(expectedStart.getTime());
    });

    it("month range is rolling 30 days", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "month", now);

      const expectedStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      expect(new Date(stats.start_date).getTime()).toBe(expectedStart.getTime());
    });
  });

  describe("Stats Calculations", () => {
    it("calculates win rate correctly", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      // trade-3: +50% (win), trade-4: -20% (loss)
      // Both exited on 2025-01-15
      expect(stats.total_trades).toBe(2);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.win_rate).toBe(50);
    });

    it("calculates average P&L correctly", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      // trade-3: +50%, trade-4: -20%
      // avg = 30 / 2 = 15%
      expect(stats.avg_pnl_percent).toBe(15);
    });

    it("tracks best and worst trades", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      expect(stats.best_trade.percent).toBe(50);
      expect(stats.best_trade.id).toBe("trade-3");
      expect(stats.worst_trade.percent).toBe(-20);
      expect(stats.worst_trade.id).toBe("trade-4");
    });

    it("tracks by-type breakdown", () => {
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      // trade-3: Swing +50%, trade-4: Scalp -20%
      expect(stats.by_type.Swing.count).toBe(1);
      expect(stats.by_type.Swing.wins).toBe(1);
      expect(stats.by_type.Scalp.count).toBe(1);
      expect(stats.by_type.Scalp.losses).toBe(1);
    });
  });

  describe("Edge Cases", () => {
    it("handles no trades in range", () => {
      // Set time to before any trades
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const now = new Date();
      const stats = calculateStatsSummary(mockTrades, "day", now);

      expect(stats.total_trades).toBe(0);
      expect(stats.win_rate).toBe(0);
      expect(stats.avg_pnl_percent).toBe(0);
    });

    it("handles 100% win rate", () => {
      // Mock all wins
      const allWins: MockPublicTrade[] = [
        {
          ...mockTrades[0],
          state: "EXITED",
          exit_price: 150,
          exit_time: "2025-01-15T12:00:00Z",
        },
      ];
      vi.setSystemTime(new Date("2025-01-15T15:00:00Z"));
      const stats = calculateStatsSummary(allWins, "day", new Date());

      expect(stats.win_rate).toBe(100);
    });

    it("handles 0% win rate", () => {
      // Mock all losses
      const allLosses: MockPublicTrade[] = [
        {
          ...mockTrades[0],
          state: "EXITED",
          exit_price: 50,
          exit_time: "2025-01-15T12:00:00Z",
        },
      ];
      vi.setSystemTime(new Date("2025-01-15T15:00:00Z"));
      const stats = calculateStatsSummary(allLosses, "day", new Date());

      expect(stats.win_rate).toBe(0);
      expect(stats.losses).toBe(1);
    });
  });
});

// ============================================================================
// GET /api/public/alerts/recent Tests
// ============================================================================

describe("GET /api/public/alerts/recent", () => {
  interface MockTradeUpdate {
    id: string;
    trade_id: string;
    type: string;
    message: string;
    price: number;
    pnl_percent: number | null;
    trim_percent: number | null;
    created_at: string;
    trade: {
      id: string;
      ticker: string;
      trade_type: string;
      contract: any;
      admin_name: string;
    };
  }

  const mockUpdates: MockTradeUpdate[] = [
    {
      id: "update-1",
      trade_id: "trade-1",
      type: "enter",
      message: "Entry at $1.50",
      price: 1.5,
      pnl_percent: null,
      trim_percent: null,
      created_at: "2025-01-15T10:00:00Z",
      trade: {
        id: "trade-1",
        ticker: "SPY",
        trade_type: "Scalp",
        contract: { strike: 595, type: "C" },
        admin_name: "Admin A",
      },
    },
    {
      id: "update-2",
      trade_id: "trade-1",
      type: "trim",
      message: "Trimmed 50%",
      price: 2.0,
      pnl_percent: 33,
      trim_percent: 50,
      created_at: "2025-01-15T11:00:00Z",
      trade: {
        id: "trade-1",
        ticker: "SPY",
        trade_type: "Scalp",
        contract: { strike: 595, type: "C" },
        admin_name: "Admin A",
      },
    },
  ];

  describe("Alert Limiting", () => {
    it("returns 3 alerts for non-members", () => {
      const isMember = false;
      const limit = isMember ? 50 : 3;

      const alerts = mockUpdates.slice(0, limit);
      expect(alerts.length).toBeLessThanOrEqual(3);
    });

    it("returns 50 alerts for members", () => {
      const isMember = true;
      const limit = isMember ? 50 : 3;

      expect(limit).toBe(50);
    });
  });

  describe("Alert Format", () => {
    it("formats alert with nested trade info", () => {
      const update = mockUpdates[0];
      const formatted = {
        id: update.id,
        type: update.type,
        message: update.message,
        price: update.price,
        pnl_percent: update.pnl_percent,
        trim_percent: update.trim_percent,
        created_at: update.created_at,
        trade: {
          id: update.trade.id,
          ticker: update.trade.ticker,
          trade_type: update.trade.trade_type,
          contract: update.trade.contract,
          admin_name: update.trade.admin_name,
        },
      };

      expect(formatted).toHaveProperty("id");
      expect(formatted).toHaveProperty("type");
      expect(formatted).toHaveProperty("trade");
      expect(formatted.trade).toHaveProperty("ticker");
      expect(formatted.trade).toHaveProperty("contract");
    });
  });

  describe("has_more Flag", () => {
    it("sets has_more=true when non-member and at limit", () => {
      const isMember = false;
      const limit = 3;
      const actualCount = 3;

      const hasMore = !isMember && actualCount >= limit;
      expect(hasMore).toBe(true);
    });

    it("sets has_more=false for members", () => {
      const isMember = true;
      const limit = 50;
      const actualCount = 3;

      const hasMore = !isMember && actualCount >= limit;
      expect(hasMore).toBe(false);
    });
  });
});

// ============================================================================
// GET /api/public/challenges/active Tests
// ============================================================================

describe("GET /api/public/challenges/active", () => {
  interface MockChallenge {
    id: string;
    name: string;
    description: string;
    starting_balance: number;
    current_balance: number;
    target_balance: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
  }

  const mockChallenges: MockChallenge[] = [
    {
      id: "challenge-1",
      name: "January Challenge",
      description: "Grow $1000 to $2000",
      starting_balance: 1000,
      current_balance: 1500,
      target_balance: 2000,
      start_date: "2025-01-01",
      end_date: "2025-01-31",
      is_active: true,
    },
    {
      id: "challenge-2",
      name: "Q1 Challenge",
      description: "Long-term growth",
      starting_balance: 5000,
      current_balance: 5000,
      target_balance: 10000,
      start_date: "2025-01-01",
      end_date: "2025-03-31",
      is_active: true,
    },
  ];

  describe("Progress Calculation", () => {
    it("calculates progress_percent correctly", () => {
      const challenge = mockChallenges[0];
      const targetGain = challenge.target_balance - challenge.starting_balance;
      const currentGain = challenge.current_balance - challenge.starting_balance;
      const progress = (currentGain / targetGain) * 100;

      // Starting: 1000, Current: 1500, Target: 2000
      // Progress = (500 / 1000) * 100 = 50%
      expect(progress).toBe(50);
    });

    it("calculates current_pnl correctly", () => {
      const challenge = mockChallenges[0];
      const currentPnl = challenge.current_balance - challenge.starting_balance;

      expect(currentPnl).toBe(500);
    });

    it("handles 0% progress", () => {
      const challenge = mockChallenges[1];
      const targetGain = challenge.target_balance - challenge.starting_balance;
      const currentGain = challenge.current_balance - challenge.starting_balance;
      const progress = targetGain > 0 ? (currentGain / targetGain) * 100 : 0;

      expect(progress).toBe(0);
    });
  });

  describe("Days Calculation", () => {
    beforeEach(() => {
      vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("calculates days_elapsed correctly", () => {
      const challenge = mockChallenges[0];
      const startDate = new Date(challenge.start_date);
      const now = new Date();
      const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Jan 1 (midnight UTC) to Jan 15 12:00 UTC = 14.5 days, ceil = 15
      expect(daysElapsed).toBe(15);
    });

    it("calculates days_remaining correctly", () => {
      const challenge = mockChallenges[0];
      const startDate = new Date(challenge.start_date);
      const endDate = new Date(challenge.end_date);
      const now = new Date();

      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, totalDays - daysElapsed);

      // Total: 30 days, Elapsed: 15 days, Remaining: 15 days
      expect(daysRemaining).toBe(15);
    });
  });
});

// ============================================================================
// State Filter Constants Tests
// ============================================================================

describe("State Filter Constants", () => {
  it("ACTIVE_TRADE_STATES includes both cases", () => {
    expect(ACTIVE_TRADE_STATES).toContain("LOADED");
    expect(ACTIVE_TRADE_STATES).toContain("loaded");
    expect(ACTIVE_TRADE_STATES).toContain("ENTERED");
    expect(ACTIVE_TRADE_STATES).toContain("entered");
  });

  it("EXITED_TRADE_STATES includes both cases", () => {
    expect(EXITED_TRADE_STATES).toContain("EXITED");
    expect(EXITED_TRADE_STATES).toContain("exited");
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Error Handling", () => {
  describe("Invalid Trade Data", () => {
    it("handles null entry_price gracefully", () => {
      const pnl = calculatePnlPercent(null, 100);
      expect(pnl).toBeNull();
    });

    it("handles null current_price gracefully", () => {
      const pnl = calculatePnlPercent(100, null);
      expect(pnl).toBeNull();
    });

    it("handles zero entry_price gracefully", () => {
      const pnl = calculatePnlPercent(0, 100);
      expect(pnl).toBeNull(); // Divide by zero case
    });

    it("handles zero current_price as valid (total loss)", () => {
      const pnl = calculatePnlPercent(100, 0);
      expect(pnl).toBe(-100);
    });
  });

  describe("getBestPrice Fallback", () => {
    it("returns primary when not null", () => {
      expect(getBestPrice(100, 50)).toBe(100);
    });

    it("returns fallback when primary is null", () => {
      expect(getBestPrice(null, 50)).toBe(50);
    });

    it("preserves 0 as valid primary", () => {
      expect(getBestPrice(0, 100)).toBe(0);
    });

    it("returns null when both are null", () => {
      expect(getBestPrice(null, null)).toBeNull();
    });
  });
});
