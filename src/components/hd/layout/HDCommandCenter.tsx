/**
 * HDCommandCenter.tsx - Unified Command Center
 *
 * Integrates all Phase 1 components into a single command center:
 * - Alert Feed (real-time tiered alerts)
 * - Portfolio Health (P&L + Greeks dashboard)
 * - AI Recommendations (profit optimization with approval)
 * - Active Trades (enhanced with risk indicators)
 *
 * Designed to fit in the left panel (320px width).
 */

import { useState } from 'react';
import { HDAlertFeed } from '../alerts/HDAlertFeed';
import { HDPortfolioHealth } from '../dashboard/HDPortfolioHealth';
import { HDAIRecommendations } from '../common/HDAIRecommendations';
import { useCommandCenter } from '../../hooks/useCommandCenter';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Section {
  id: string;
  title: string;
  component: React.ReactNode;
  defaultOpen: boolean;
}

export function HDCommandCenter() {
  // Start Command Center monitoring
  const { isRunning } = useCommandCenter();

  const sections: Section[] = [
    {
      id: 'portfolio',
      title: 'Portfolio Health',
      component: <HDPortfolioHealth />,
      defaultOpen: true,
    },
    {
      id: 'recommendations',
      title: 'AI Recommendations',
      component: <HDAIRecommendations maxRecommendations={3} />,
      defaultOpen: true,
    },
    {
      id: 'alerts',
      title: 'Alert Feed',
      component: <HDAlertFeed maxAlerts={5} />,
      defaultOpen: true,
    },
  ];

  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(sections.filter((s) => s.defaultOpen).map((s) => s.id))
  );

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full space-y-3">
      {sections.map((section) => {
        const isOpen = openSections.has(section.id);

        return (
          <div
            key={section.id}
            className="border border-[var(--border-hairline)] rounded-lg bg-[var(--surface-1)] overflow-hidden"
          >
            {/* Section Header (Collapsible) */}
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full p-3 flex items-center justify-between hover:bg-[var(--surface-2)] transition-colors"
            >
              <h3 className="text-xs font-semibold text-[var(--text-high)] uppercase tracking-wider">
                {section.title}
              </h3>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </button>

            {/* Section Content */}
            {isOpen && (
              <div className="p-3 border-t border-[var(--border-hairline)]">
                {section.component}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
