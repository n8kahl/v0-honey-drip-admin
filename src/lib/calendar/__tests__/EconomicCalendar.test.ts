/**
 * Tests for Economic Calendar Service
 * Phase 2.4: Economic Calendar Integration
 */

import { describe, it, expect } from "vitest";
import {
  fetchEconomicCalendar,
  fetchEarningsCalendar,
  analyzeCalendarForTrading,
  isNearHighImpactEvent,
  getEventsForSymbol,
  formatEventDisplay,
  MAJOR_ECONOMIC_EVENTS,
  type EconomicEvent,
  type EarningsEvent,
} from "../EconomicCalendar";

describe("EconomicCalendar", () => {
  describe("fetchEconomicCalendar", () => {
    it("returns events within date range", async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      const events = await fetchEconomicCalendar(startDate, endDate);

      expect(Array.isArray(events)).toBe(true);
      events.forEach((event) => {
        expect(event).toHaveProperty("id");
        expect(event).toHaveProperty("name");
        expect(event).toHaveProperty("datetime");
        expect(event).toHaveProperty("impact");
        expect(event).toHaveProperty("category");
        expect(event).toHaveProperty("affectsSymbols");
      });
    });

    it("filters by impact level", async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);

      const events = await fetchEconomicCalendar(startDate, endDate, {
        impactFilter: ["CRITICAL", "HIGH"],
      });

      events.forEach((event) => {
        expect(["CRITICAL", "HIGH"]).toContain(event.impact);
      });
    });
  });

  describe("fetchEarningsCalendar", () => {
    it("returns earnings events", async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const earnings = await fetchEarningsCalendar(startDate, endDate);

      expect(Array.isArray(earnings)).toBe(true);
      earnings.forEach((earning) => {
        expect(earning).toHaveProperty("symbol");
        expect(earning).toHaveProperty("name");
        expect(earning).toHaveProperty("datetime");
        expect(earning).toHaveProperty("timing");
        expect(["BMO", "AMC"]).toContain(earning.timing);
      });
    });

    it("filters by symbols when provided", async () => {
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const symbols = ["AAPL", "MSFT"];

      const earnings = await fetchEarningsCalendar(startDate, endDate, symbols);

      earnings.forEach((earning) => {
        expect(symbols).toContain(earning.symbol);
      });
    });
  });

  describe("analyzeCalendarForTrading", () => {
    it("generates comprehensive analysis", () => {
      const mockEvents: EconomicEvent[] = [
        {
          id: "1",
          name: "CPI",
          datetime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: ["SPY", "SPX"],
        },
        {
          id: "2",
          name: "Initial Jobless Claims",
          datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          impact: "MEDIUM",
          category: "EMPLOYMENT",
          affectsSymbols: ["SPY"],
        },
      ];

      const mockEarnings: EarningsEvent[] = [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timing: "AMC",
        },
      ];

      const analysis = analyzeCalendarForTrading(mockEvents, mockEarnings, ["SPY", "AAPL"]);

      expect(analysis).toHaveProperty("eventsNext24h");
      expect(analysis).toHaveProperty("eventsNext7d");
      expect(analysis).toHaveProperty("earningsThisWeek");
      expect(analysis).toHaveProperty("tradingRecommendations");
      expect(analysis).toHaveProperty("highRiskPeriods");
      expect(analysis).toHaveProperty("marketSentiment");
      expect(analysis).toHaveProperty("volatilityOutlook");

      // Should have CPI in next 24h
      expect(analysis.eventsNext24h.length).toBe(1);
      expect(analysis.eventsNext24h[0].name).toBe("CPI");

      // Should have recommendations due to critical event
      expect(analysis.tradingRecommendations.length).toBeGreaterThan(0);

      // Should identify high risk periods
      expect(analysis.highRiskPeriods.length).toBeGreaterThan(0);
    });

    it("determines correct market sentiment", () => {
      // Risk-off: Multiple critical events
      const criticalEvents: EconomicEvent[] = [
        {
          id: "1",
          name: "FOMC Meeting",
          datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          impact: "CRITICAL",
          category: "FED",
          affectsSymbols: ["SPY"],
        },
        {
          id: "2",
          name: "CPI",
          datetime: new Date(Date.now() + 48 * 60 * 60 * 1000),
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: ["SPY"],
        },
      ];

      const riskOffAnalysis = analyzeCalendarForTrading(criticalEvents, [], ["SPY"]);
      expect(riskOffAnalysis.marketSentiment).toBe("risk-off");

      // Risk-on: No critical events
      const mildEvents: EconomicEvent[] = [
        {
          id: "1",
          name: "Housing Starts",
          datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          impact: "LOW",
          category: "HOUSING",
          affectsSymbols: ["XHB"],
        },
      ];

      const riskOnAnalysis = analyzeCalendarForTrading(mildEvents, [], ["SPY"]);
      expect(riskOnAnalysis.marketSentiment).toBe("risk-on");
    });
  });

  describe("isNearHighImpactEvent", () => {
    it("detects proximity to high impact events", () => {
      const events: EconomicEvent[] = [
        {
          id: "1",
          name: "CPI",
          datetime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: ["SPY"],
        },
      ];

      const result = isNearHighImpactEvent(events, 30);

      expect(result.isNear).toBe(true);
      expect(result.event?.name).toBe("CPI");
      expect(result.minutesUntil).toBeLessThan(20);
      expect(result.minutesUntil).toBeGreaterThan(10);
    });

    it("returns false when no high impact events are near", () => {
      const events: EconomicEvent[] = [
        {
          id: "1",
          name: "Housing Starts",
          datetime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          impact: "LOW",
          category: "HOUSING",
          affectsSymbols: ["XHB"],
        },
      ];

      const result = isNearHighImpactEvent(events, 30);

      expect(result.isNear).toBe(false);
      expect(result.event).toBeNull();
    });
  });

  describe("getEventsForSymbol", () => {
    it("filters events affecting specific symbol", () => {
      const events: EconomicEvent[] = [
        {
          id: "1",
          name: "CPI",
          datetime: new Date(),
          impact: "CRITICAL",
          category: "INFLATION",
          affectsSymbols: ["SPY", "SPX", "QQQ"],
        },
        {
          id: "2",
          name: "Housing Starts",
          datetime: new Date(),
          impact: "LOW",
          category: "HOUSING",
          affectsSymbols: ["XHB", "ITB"],
        },
      ];

      // SPY gets CPI directly AND Housing via SPY fallback (major events affect all equities)
      const spyEvents = getEventsForSymbol(events, "SPY");
      expect(spyEvents.length).toBe(1); // CPI directly affects SPY

      // XHB gets Housing directly AND CPI via SPY fallback
      const xhbEvents = getEventsForSymbol(events, "XHB");
      expect(xhbEvents.length).toBe(2); // Housing + CPI (via SPY fallback)
    });
  });

  describe("formatEventDisplay", () => {
    it("formats event for display with emoji", () => {
      const event: EconomicEvent = {
        id: "1",
        name: "FOMC Meeting",
        datetime: new Date("2025-01-15T14:00:00"),
        impact: "CRITICAL",
        category: "FED",
        affectsSymbols: ["SPY"],
      };

      const formatted = formatEventDisplay(event);

      expect(formatted).toContain("FOMC Meeting");
      // Should have an impact emoji at the start
      expect(
        formatted.includes("\u{1F534}") || // 🔴
          formatted.includes("\u{1F7E0}") || // 🟠
          formatted.includes("\u{1F7E1}") || // 🟡
          formatted.includes("\u{1F7E2}") // 🟢
      ).toBe(true);
    });

    it("uses correct emoji for each impact level", () => {
      const impacts: Array<{ impact: EconomicEvent["impact"]; emoji: string }> = [
        { impact: "CRITICAL", emoji: "🔴" },
        { impact: "HIGH", emoji: "🟠" },
        { impact: "MEDIUM", emoji: "🟡" },
        { impact: "LOW", emoji: "🟢" },
      ];

      impacts.forEach(({ impact, emoji }) => {
        const event: EconomicEvent = {
          id: "1",
          name: "Test Event",
          datetime: new Date(),
          impact,
          category: "OTHER",
          affectsSymbols: ["SPY"],
        };

        const formatted = formatEventDisplay(event);
        expect(formatted).toContain(emoji);
      });
    });
  });

  describe("MAJOR_ECONOMIC_EVENTS", () => {
    it("contains key economic events", () => {
      const keyEvents = [
        "FOMC Meeting",
        "Non-Farm Payrolls",
        "CPI",
        "GDP",
        "Initial Jobless Claims",
      ];

      keyEvents.forEach((eventName) => {
        expect(MAJOR_ECONOMIC_EVENTS).toHaveProperty(eventName);
        expect(MAJOR_ECONOMIC_EVENTS[eventName]).toHaveProperty("impact");
        expect(MAJOR_ECONOMIC_EVENTS[eventName]).toHaveProperty("category");
        expect(MAJOR_ECONOMIC_EVENTS[eventName]).toHaveProperty("affectsSymbols");
      });
    });

    it("has correct impact levels for major events", () => {
      expect(MAJOR_ECONOMIC_EVENTS["FOMC Meeting"].impact).toBe("CRITICAL");
      expect(MAJOR_ECONOMIC_EVENTS["Non-Farm Payrolls"].impact).toBe("CRITICAL");
      expect(MAJOR_ECONOMIC_EVENTS["CPI"].impact).toBe("CRITICAL");
      expect(MAJOR_ECONOMIC_EVENTS["GDP"].impact).toBe("HIGH");
      expect(MAJOR_ECONOMIC_EVENTS["Initial Jobless Claims"].impact).toBe("MEDIUM");
    });

    it("includes SPY for major market-moving events", () => {
      const marketMovingEvents = ["FOMC Meeting", "Non-Farm Payrolls", "CPI"];

      marketMovingEvents.forEach((eventName) => {
        expect(MAJOR_ECONOMIC_EVENTS[eventName].affectsSymbols).toContain("SPY");
      });
    });
  });
});
