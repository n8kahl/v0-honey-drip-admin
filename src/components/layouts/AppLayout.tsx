import React, { ReactNode } from 'react';
import { LiveStatusBar } from '../LiveStatusBar';
import { MobileBottomNav } from '../MobileBottomNav';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../lib/utils';

/**
 * AppLayout - Main layout wrapper for dashboard pages
 *
 * Provides consistent shell for:
 * - Home/Dashboard
 * - Active Trades
 * - Trade History
 * - Settings
 *
 * Features:
 * - LiveStatusBar at top
 * - Responsive main content area
 * - Desktop tab navigation (handled by parent or child)
 * - Mobile bottom navigation
 * - Optional dock at bottom (for active trades)
 *
 * Props:
 * - children: Page content to render
 * - showDock: Show ActiveTradesDock at bottom (default: true)
 * - hideMainBottomNav: Hide mobile bottom nav (default: false)
 * - className: Additional classes for main content
 */
export interface AppLayoutProps {
  children: ReactNode;
  showDock?: boolean;
  hideMainBottomNav?: boolean;
  className?: string;
}

export function AppLayout({
  children,
  showDock = true,
  hideMainBottomNav = false,
  className,
}: AppLayoutProps) {
  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col pb-16 lg:pb-0">
      {/* Status bar - always visible */}
      <LiveStatusBar />

      {/* Main content area */}
      <main className={cn('flex-1 w-full bg-[var(--bg-base)]', className)}>
        {children}
      </main>

      {/* Mobile bottom navigation - only on small screens */}
      {!hideMainBottomNav && (
        <div className="lg:hidden">
          <MobileBottomNav
            activeTab={activeTab as any}
            onTabChange={(tab) => useUIStore.getState().setActiveTab(tab as any)}
            hasActiveTrades={false} // Can be passed as prop
            flashTradeTab={useUIStore.getState().flashTradeTab}
          />
        </div>
      )}
    </div>
  );
}
