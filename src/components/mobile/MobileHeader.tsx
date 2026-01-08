import { cn } from "../../lib/utils";
import { branding } from "../../lib/config/branding";

interface MobileHeaderProps {
  rightContent?: React.ReactNode;
}

export function MobileHeader({ rightContent }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 h-header-safe bg-[var(--surface-1)] border-b border-[var(--border-hairline)] flex items-end justify-between px-4 pb-2 z-50">
      {/* Logo + Brand */}
      <div className="flex items-center gap-2">
        <img src={branding.logoUrl} alt={branding.appName} className="w-8 h-8 object-contain" />
        <span className="text-[var(--text-high)] font-semibold text-sm">{branding.appName}</span>
      </div>

      {/* Right side: Status */}
      <div className="flex items-center gap-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">Live</span>
        </div>

        {rightContent}
      </div>
    </header>
  );
}
