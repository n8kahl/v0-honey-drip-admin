/**
 * HDRadarOffHours - "War Room" Command Center for off-hours trading prep
 *
 * Forward-looking intelligence dashboard:
 * - Market regime and session bias
 * - If/then scenarios for next session
 * - Opportunity matrix (scatter chart)
 * - Battle plan board (Kanban)
 * - Economic calendar
 */

import { useState, useMemo, useEffect } from "react";
import { useOffHoursData } from "../../../hooks/useOffHoursData";
import { cn } from "../../../lib/utils";
import { AlertTriangle } from "lucide-react";

// Existing components
import { HDWeeklyCalendar } from "./HDWeeklyCalendar";

// New War Room components
import { HDMarketHorizon } from "./visuals/HDMarketHorizon";
import { HDSessionScenarios } from "./visuals/HDSessionScenarios";
import { OpportunityMatrix } from "./visuals/OpportunityMatrix";
import { BattlePlanBoard } from "./visuals/BattlePlanBoard";

// Types and utilities
import {
  generateMarketHorizonData,
  generateOpportunityMatrix,
  generateSessionScenarios,
  type BattlePlanItem,
  type SessionScenario,
} from "../../../types/radar-visuals";
import { toast } from "sonner";

interface HDRadarOffHoursProps {
  className?: string;
}

const BATTLE_PLAN_STORAGE_KEY = "honeydrip_battle_plan";

export function HDRadarOffHours({ className }: HDRadarOffHoursProps) {
  const { futures, keyLevelsBySymbol, setupScenarios, error, refresh, loading } = useOffHoursData();

  // Battle plan state (persisted to localStorage)
  const [battlePlanItems, setBattlePlanItems] = useState<BattlePlanItem[]>(() => {
    try {
      const saved = localStorage.getItem(BATTLE_PLAN_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert createdAt strings back to Date objects
        return parsed.map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
        }));
      }
    } catch (err) {
      console.error("[HDRadarOffHours] Failed to load battle plan from localStorage:", err);
    }
    return [];
  });

  // Persist battle plan to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(BATTLE_PLAN_STORAGE_KEY, JSON.stringify(battlePlanItems));
    } catch (err) {
      console.error("[HDRadarOffHours] Failed to save battle plan to localStorage:", err);
    }
  }, [battlePlanItems]);

  // Derive market horizon data
  const vix = futures?.vix.value || 15;
  const horizonData = useMemo(() => generateMarketHorizonData(vix, futures), [vix, futures]);

  // Generate opportunity matrix data from setup scenarios
  const opportunityData = useMemo(
    () => generateOpportunityMatrix(setupScenarios),
    [setupScenarios]
  );

  // Generate session scenarios from key levels (for first symbol with most levels)
  const sessionScenariosData = useMemo(() => {
    if (keyLevelsBySymbol.size === 0) return [];

    // Find symbol with most key levels
    let bestSymbol: string | null = null;
    let maxLevels = 0;

    keyLevelsBySymbol.forEach((data, symbol) => {
      if (data.levels.length > maxLevels) {
        maxLevels = data.levels.length;
        bestSymbol = symbol;
      }
    });

    if (!bestSymbol) return [];

    const symbolData = keyLevelsBySymbol.get(bestSymbol)!;
    return generateSessionScenarios(
      bestSymbol,
      symbolData.currentPrice,
      symbolData.levels,
      futures
    );
  }, [keyLevelsBySymbol, futures]);

  // Add ticker to battle plan from OpportunityMatrix
  const handleAddTicker = (symbol: string) => {
    // Check if already exists
    if (battlePlanItems.some((item) => item.symbol === symbol)) {
      toast.info(`${symbol} is already in your battle plan`);
      return;
    }

    // Find setup data for this symbol
    const setup = setupScenarios.find((s) => s.symbol === symbol);

    const newItem: BattlePlanItem = {
      id: crypto.randomUUID(),
      symbol,
      status: "radar",
      notes: "",
      createdAt: new Date(),
      setupId: setup?.id,
      direction: setup?.direction,
      entryLevel: setup?.entry,
      targetLevel: setup?.targets[0],
    };

    setBattlePlanItems((prev) => [...prev, newItem]);
    toast.success(`Added ${symbol} to battle plan`);
  };

  // Add from session scenario
  const handleAddFromScenario = (symbol: string, scenario: SessionScenario) => {
    if (battlePlanItems.some((item) => item.symbol === symbol)) {
      toast.info(`${symbol} is already in your battle plan`);
      return;
    }

    const newItem: BattlePlanItem = {
      id: crypto.randomUUID(),
      symbol,
      status: "radar",
      notes: `${scenario.caseType.toUpperCase()} CASE: ${scenario.trigger}\n${scenario.action}`,
      createdAt: new Date(),
      direction:
        scenario.caseType === "bull" ? "long" : scenario.caseType === "bear" ? "short" : undefined,
      entryLevel: scenario.entry,
      targetLevel: scenario.targets[0],
    };

    setBattlePlanItems((prev) => [...prev, newItem]);
    toast.success(`Added ${symbol} (${scenario.caseType} case) to battle plan`);
  };

  // Update battle plan item
  const handleUpdateItem = (updatedItem: BattlePlanItem) => {
    setBattlePlanItems((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  // Remove from battle plan
  const handleRemoveItem = (id: string) => {
    const item = battlePlanItems.find((i) => i.id === id);
    setBattlePlanItems((prev) => prev.filter((item) => item.id !== id));
    if (item) {
      toast.success(`Removed ${item.symbol} from battle plan`);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Market Horizon Hero */}
      <HDMarketHorizon vix={vix} regime={horizonData.regime} horizonData={horizonData} />

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
          <button onClick={refresh} className="ml-auto text-sm underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Forward Intelligence */}
        <div className="lg:col-span-4 space-y-6">
          {/* Session Scenarios (If/Then Playbook) */}
          <HDSessionScenarios
            scenarios={sessionScenariosData}
            onAddToBattlePlan={handleAddFromScenario}
          />

          {/* Weekly Economic Calendar */}
          <HDWeeklyCalendar maxEvents={6} />
        </div>

        {/* Right Column - Setups & Planning */}
        <div className="lg:col-span-8 space-y-6">
          {/* Opportunity Matrix (Scatter Chart) */}
          <OpportunityMatrix data={opportunityData} onAddTicker={handleAddTicker} />

          {/* Battle Plan Board (Kanban) */}
          <BattlePlanBoard
            items={battlePlanItems}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveItem}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 border-t border-[var(--border-hairline)]">
        <p className="text-sm text-[var(--text-muted)]">
          War Room refreshes with market data.{" "}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-[var(--brand-primary)] hover:underline disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh now"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default HDRadarOffHours;
