export * from "./types";
export * from "./indicators";
export * from "./calculator";
export * from "./profiles";
export * from "./marketContext";

// Phase 2.2: Level-Aware Stops
export * from "./LevelAwareStops";

// Phase 4: Plan Anchors with rationale
export * from "./planAnchors";

// Default admin settings
import { AdminRiskDefaults } from "./types";

export const DEFAULT_RISK_SETTINGS: AdminRiskDefaults = {
  mode: "calculated",
  tpPercent: 50,
  slPercent: 20,
  trailMode: "atr",
  atrPeriod: 14,
  atrMultiplier: 1.5,
  dteThresholds: {
    scalp: 2, // 0-2 DTE = SCALP
    day: 14, // 3-14 DTE = DAY
    swing: 60, // 15-60 DTE = SWING (>60 = LEAP)
  },
  orbMinutes: 15, // Opening Range Breakout window
};
