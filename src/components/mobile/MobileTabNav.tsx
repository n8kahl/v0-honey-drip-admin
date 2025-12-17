import { Zap, Eye, History, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

export type MobileTab = "active" | "watch" | "review" | "settings";

interface MobileTabNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  activeTradesCount?: number;
  loadedTradesCount?: number;
}

const tabs = [
  { id: "active" as MobileTab, label: "Active", icon: Zap },
  { id: "watch" as MobileTab, label: "Watch", icon: Eye },
  { id: "review" as MobileTab, label: "Review", icon: History },
  { id: "settings" as MobileTab, label: "Settings", icon: Settings },
];

export function MobileTabNav({
  activeTab,
  onTabChange,
  activeTradesCount = 0,
  loadedTradesCount = 0,
}: MobileTabNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-nav-safe bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-start justify-around pt-2 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const badge =
          tab.id === "active" ? activeTradesCount : tab.id === "watch" ? loadedTradesCount : 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative",
              "min-h-[44px] min-w-[44px]", // Touch target
              isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5]")} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold bg-[var(--brand-primary)] text-black rounded-full px-1">
                  {badge}
                </span>
              )}
            </div>
            <span className={cn("text-[11px]", isActive && "font-semibold")}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
