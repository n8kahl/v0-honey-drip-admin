/**
 * Public Portal Components
 *
 * Export all public-facing components for the portal.
 * Canonical types are in @/types/public.ts - re-exported here for convenience.
 */

// Components
export { DailyScorecard, type DailyStats } from "./DailyScorecard";
export { LiveTradeCard, LiveTradeCardCompact } from "./LiveTradeCard";
export { TradeTypeSection, TradeList } from "./TradeTypeSection";
export { AlertFeed } from "./AlertFeed";
export { MemberGate, DemoViewToggle, GatedSection } from "./MemberGate";
export { TradeTimeline, CompactTimeline, type TimelineUpdate } from "./TradeTimeline";
export { TradeDetailModal } from "./TradeDetailModal";

// Re-export canonical types from @/types/public for convenience
export type {
  PublicTrade,
  PublicTradeAlert,
  PublicChallenge,
  PublicStatsSummary,
  AdminStats,
  StatsRange,
  PublicContract,
  PublicContractType,
  PublicTradeType,
  PublicTradeState,
  PublicAlertType,
  PublicPortalFreshness,
  ModuleStatus,
} from "@/types/public";

// Legacy alias
export type { PublicTradeAlert as TradeAlert } from "@/types/public";
