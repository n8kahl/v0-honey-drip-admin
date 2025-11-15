import { BarChart3, Activity, History } from 'lucide-react';
import { cn } from '../lib/utils';

type Tab = 'live' | 'active' | 'history';

interface MobileBottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasActiveTrades?: boolean;
  flashTradeTab?: boolean;
}

export function MobileBottomNav({ activeTab, onTabChange, hasActiveTrades = false, flashTradeTab = false }: MobileBottomNavProps) {
  const tabs = [
    { id: 'live' as Tab, label: 'Watch', icon: BarChart3 },
    { id: 'active' as Tab, label: 'Trade', icon: Activity },
    { id: 'history' as Tab, label: 'Review', icon: History },
  ];
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] flex items-center justify-around safe-area-inset-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const shouldFlash = tab.id === 'active' && (hasActiveTrades || flashTradeTab);
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors relative',
              isActive ? 'text-[var(--brand-primary)]' : 'text-[var(--text-muted)]'
            )}
          >
            <Icon className={cn(
              'w-5 h-5', 
              isActive && 'stroke-[2.5]',
              shouldFlash && 'animate-slow-flash'
            )} />
            <span className={cn(
              'text-[10px]', 
              isActive && 'font-medium',
              shouldFlash && 'animate-slow-flash'
            )}>{tab.label}</span>
            {shouldFlash && !isActive && (
              <span className="absolute top-2 right-1/4 w-1.5 h-1.5 bg-[var(--brand-primary)] rounded-full animate-slow-flash" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
