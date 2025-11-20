import React, { ReactNode } from 'react';
import { LiveStatusBar } from '../LiveStatusBar';
import { cn } from '../../lib/utils';

/**
 * RadarLayout - Layout wrapper for the radar/scanner page
 *
 * Provides a clean, full-height layout for the radar symbol scanner.
 *
 * Features:
 * - LiveStatusBar at top
 * - Full-height content area
 * - Keyboard shortcuts (handled separately via RadarHotkey)
 * - No dock, no bottom nav (radar is a focused experience)
 *
 * Props:
 * - children: Page content to render
 * - className: Additional classes for main content
 */
export interface RadarLayoutProps {
  children: ReactNode;
  className?: string;
}

export function RadarLayout({ children, className }: RadarLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col">
      {/* Status bar - always visible */}
      <LiveStatusBar />

      {/* Full-height content area (no bottom nav, no dock) */}
      <main className={cn('flex-1 w-full bg-[var(--bg-base)]', className)}>
        {children}
      </main>
    </div>
  );
}
