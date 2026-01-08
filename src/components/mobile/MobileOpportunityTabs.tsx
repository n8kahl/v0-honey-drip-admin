/**
 * MobileOpportunityTabs - Swipeable tabbed navigation
 *
 * Three tabs for the "Opportunity Stack":
 * - SCAN: Watchlist cards (discovery)
 * - DEEP: Chart & Analysis (the "Why")
 * - MGMT: Active Trades & Risk
 *
 * Touch-optimized with 44px+ targets and swipe gestures.
 */

import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Radar, BarChart3, Shield } from "lucide-react";
import { cn } from "../../lib/utils";

export type OpportunityTab = "scan" | "deep" | "mgmt";

interface TabConfig {
  id: OpportunityTab;
  label: string;
  icon: typeof Radar;
  badge?: number;
}

interface MobileOpportunityTabsProps {
  activeTab: OpportunityTab;
  onTabChange: (tab: OpportunityTab) => void;
  scanContent: ReactNode;
  deepContent: ReactNode;
  mgmtContent: ReactNode;
  scanBadge?: number;
  mgmtBadge?: number;
}

const tabs: TabConfig[] = [
  { id: "scan", label: "SCAN", icon: Radar },
  { id: "deep", label: "DEEP", icon: BarChart3 },
  { id: "mgmt", label: "MGMT", icon: Shield },
];

export function MobileOpportunityTabs({
  activeTab,
  onTabChange,
  scanContent,
  deepContent,
  mgmtContent,
  scanBadge,
  mgmtBadge,
}: MobileOpportunityTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);

  // Get tab index
  const getTabIndex = (tab: OpportunityTab): number => tabs.findIndex((t) => t.id === tab);
  const activeIndex = getTabIndex(activeTab);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setCurrentX(0);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const deltaX = e.touches[0].clientX - startX;
      setCurrentX(deltaX);
    },
    [isDragging, startX]
  );

  // Handle touch end - determine swipe direction
  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    const threshold = 50; // Minimum swipe distance

    if (currentX > threshold && activeIndex > 0) {
      // Swipe right - go to previous tab
      onTabChange(tabs[activeIndex - 1].id);
    } else if (currentX < -threshold && activeIndex < tabs.length - 1) {
      // Swipe left - go to next tab
      onTabChange(tabs[activeIndex + 1].id);
    }

    setIsDragging(false);
    setCurrentX(0);
  }, [isDragging, currentX, activeIndex, onTabChange]);

  // Get badge for a tab
  const getBadge = (tabId: OpportunityTab): number | undefined => {
    if (tabId === "scan") return scanBadge;
    if (tabId === "mgmt") return mgmtBadge;
    return undefined;
  };

  // Render tab content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case "scan":
        return scanContent;
      case "deep":
        return deepContent;
      case "mgmt":
        return mgmtContent;
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab Bar */}
      <div className="flex-shrink-0 bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badge = getBadge(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4",
                  "min-h-[48px] transition-colors relative",
                  "text-sm font-semibold uppercase tracking-wider",
                  isActive
                    ? "text-[var(--brand-primary)]"
                    : "text-[var(--text-muted)] active:bg-[var(--surface-2)]"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5]")} />
                <span>{tab.label}</span>

                {/* Badge */}
                {badge !== undefined && badge > 0 && (
                  <span
                    className={cn(
                      "min-w-[20px] h-5 flex items-center justify-center",
                      "text-[11px] font-bold rounded-full px-1.5",
                      isActive
                        ? "bg-[var(--brand-primary)] text-black"
                        : "bg-[var(--surface-3)] text-[var(--text-muted)]"
                    )}
                  >
                    {badge}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-[var(--brand-primary)] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipeable Content Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={cn(
            "h-full w-full overflow-y-auto",
            isDragging && "transition-none",
            !isDragging && "transition-transform duration-300 ease-out"
          )}
          style={{
            transform: isDragging ? `translateX(${currentX * 0.3}px)` : undefined,
          }}
        >
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default MobileOpportunityTabs;
