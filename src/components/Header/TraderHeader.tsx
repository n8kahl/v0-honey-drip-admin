import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTradeStore } from '../../stores/tradeStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMarketStore } from '../../stores/marketStore';
import { useEnrichedMarketSession, useMarketDataStore } from '../../stores/marketDataStore';
import { Activity, Moon, Sun, User, ChevronDown, Menu, Settings, Radar, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { DESIGN_TOKENS } from '../../lib/designTokens';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { colorTransition, buttonHoverColor, focusStateSmooth } from '../../lib/animations';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';

interface MarketStatusProps {
  session: 'PRE' | 'OPEN' | 'POST' | 'CLOSED';
  isWeekend: boolean;
  nextOpen: number;
  nextClose: number;
  latency: number;
}

const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getDayName = (timestamp: number): string => {
  const date = new Date(timestamp);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
};

const getTimeString = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm} ET`;
};

const MarketStatus: React.FC<MarketStatusProps> = ({ session, isWeekend, nextOpen, nextClose, latency }) => {
  const [countdown, setCountdown] = useState('');
  const [statusText, setStatusText] = useState('');
  const [dotColor, setDotColor] = useState('bg-zinc-500');
  const [textColor, setTextColor] = useState('text-zinc-400');
  
  useEffect(() => {
    const updateDisplay = () => {
      const now = Date.now();
      
      if (isWeekend) {
        setDotColor('bg-purple-500');
        setTextColor('text-purple-400');
        setStatusText('Weekend');
        const msUntilOpen = nextOpen - now;
        if (msUntilOpen > 0) {
          setCountdown(`Opens ${getDayName(nextOpen)} ${getTimeString(nextOpen)}`);
        }
      } else if (session === 'PRE') {
        setDotColor('bg-amber-500 animate-pulse');
        setTextColor('text-amber-400');
        setStatusText('Pre-Market');
        const msUntilOpen = nextOpen - now;
        if (msUntilOpen > 0) {
          setCountdown(`Opens in ${formatCountdown(msUntilOpen)}`);
        }
      } else if (session === 'OPEN') {
        setDotColor('bg-green-500 animate-pulse');
        setTextColor('text-green-400');
        setStatusText('Market Open');
        const msUntilClose = nextClose - now;
        if (msUntilClose > 0) {
          setCountdown(`Closes in ${formatCountdown(msUntilClose)}`);
        }
      } else if (session === 'POST') {
        setDotColor('bg-blue-500 animate-pulse');
        setTextColor('text-blue-400');
        setStatusText('After-Hours');
        const msUntilClose = nextClose - now;
        if (msUntilClose > 0) {
          setCountdown(`Closes in ${formatCountdown(msUntilClose)}`);
        }
      } else {
        setDotColor('bg-zinc-500');
        setTextColor('text-zinc-400');
        setStatusText('Market Closed');
        const msUntilOpen = nextOpen - now;
        if (msUntilOpen > 0) {
          setCountdown(`Opens ${getDayName(nextOpen)} ${getTimeString(nextOpen)}`);
        }
      }
    };
    
    // Update immediately
    updateDisplay();
    
    // Update every second for countdown
    const interval = setInterval(updateDisplay, 1000);
    
    return () => clearInterval(interval);
  }, [session, isWeekend, nextOpen, nextClose]);
  
  const latencyColor = latency < 100 ? 'text-green-500' : latency < 300 ? 'text-yellow-500' : 'text-red-500';
  
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1.5">
        <div className={cn('w-2 h-2 rounded-full', dotColor)} />
        <span className={cn('font-medium', textColor)}>{statusText}</span>
        {countdown && (
          <>
            <span className={cn(DESIGN_TOKENS.text.muted)}>•</span>
            <span className={cn(DESIGN_TOKENS.text.muted)}>{countdown}</span>
          </>
        )}
      </div>
      <div className="w-px h-4 bg-[var(--border-hairline)]" />
      <div className="flex items-center gap-1.5">
        <Activity className={cn('w-3.5 h-3.5', latencyColor)} />
        <span className={cn('font-mono', latencyColor)}>{latency}ms</span>
      </div>
    </div>
  );
};

const ActiveSetups: React.FC = () => {
  const { count, details } = useMarketDataStore((s) => {
    const symbols = Object.values(s.symbols || {});
    let total = 0;
    const lines: string[] = [];
    for (const d of symbols) {
      const active = (d.strategySignals || []).filter((sig) => sig.status === 'ACTIVE');
      if (active.length > 0) {
        total += active.length;
        const conf = typeof d.confluence?.overall === 'number' ? Math.round(d.confluence.overall) : '-';
        lines.push(`${d.symbol}: ${active.map((a) => a.strategyId).join(', ')} · conf ${conf}`);
      }
    }
    return { count: total, details: lines };
  });

  if (!count) return null;

  const label = `Setups · ${count}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="px-2 py-1 rounded bg-zinc-700 text-zinc-300 text-xs font-medium cursor-default">
          {label}
        </div>
      </TooltipTrigger>
      {details.length > 0 && (
        <TooltipContent side="bottom" className="bg-zinc-800 text-zinc-200 border border-zinc-700">
          <div className="max-w-sm whitespace-pre-wrap text-xs">
            {details.join('\n')}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
};

interface ChallengeRingProps {
  completed: number;
  target: number;
  rMultiple: number;
  winRate: number;
}

const ChallengeRing: React.FC<ChallengeRingProps> = ({ completed, target, rMultiple, winRate }) => {
  const progress = (completed / target) * 100;
  const isNearCompletion = progress >= 80;
  
  // Conic gradient for progress ring
  const conicGradient = `conic-gradient(
    from 0deg,
    var(--brand-primary) 0%,
    var(--brand-primary) ${progress}%,
    var(--surface-3) ${progress}%,
    var(--surface-3) 100%
  )`;
  
  return (
    <div className="flex items-center gap-3">
      {/* Ring */}
      <div className="relative">
        <div
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center',
            isNearCompletion && 'animate-pulse'
          )}
          style={{
            background: conicGradient,
            padding: '3px',
          }}
        >
          <div className="w-full h-full rounded-full bg-[var(--surface-1)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--text-high)]">
              {completed}/{target}
            </span>
          </div>
        </div>
        {isNearCompletion && (
          <div className="absolute inset-0 rounded-full bg-[var(--brand-primary)]/20 blur-lg animate-pulse" />
        )}
      </div>
      
      {/* Stats */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', rMultiple >= 0 ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]')}>
            {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(1)}R today
          </span>
          <span className="text-xs text-[var(--text-muted)]">•</span>
          <span className="text-xs text-[var(--text-muted)]">{winRate.toFixed(0)}% win</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">Challenge Progress</div>
      </div>
    </div>
  );
};

interface MobileMenuProps {
  onSettingsClick?: () => void;
  onRadarClick?: () => void;
  onMonitoringClick?: () => void;
  onLogout?: () => void;
}

const MobileMenu: React.FC<MobileMenuProps> = ({ onSettingsClick, onRadarClick, onMonitoringClick, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSettingsClick = () => {
    setIsOpen(false);
    onSettingsClick?.();
  };

  const handleRadarClick = () => {
    setIsOpen(false);
    onRadarClick?.();
  };

  const handleMonitoringClick = () => {
    setIsOpen(false);
    onMonitoringClick?.();
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    onLogout?.();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            'md:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-[var(--surface-2)]',
            colorTransition,
            buttonHoverColor,
            focusStateSmooth
          )}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-[var(--text-high)]" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 bg-[var(--surface-1)] border-r border-[var(--border-hairline)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--text-high)]">Menu</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-1">
          <button
            onClick={handleSettingsClick}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-md',
              colorTransition,
              focusStateSmooth
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={handleRadarClick}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-md',
              colorTransition,
              focusStateSmooth
            )}
          >
            <Radar className="w-4 h-4" />
            <span>Radar</span>
          </button>
          <button
            onClick={handleMonitoringClick}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--text-high)] hover:bg-[var(--surface-2)] rounded-md',
              colorTransition,
              focusStateSmooth
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Monitoring</span>
          </button>
          <div className="h-px bg-[var(--border-hairline)] my-2" />
          <button
            onClick={handleLogoutClick}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-[var(--accent-negative)] hover:bg-[var(--surface-3)] rounded-md',
              colorTransition,
              focusStateSmooth
            )}
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

interface UserMenuProps {
  userName?: string;
  onLogout?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ userName = 'Trader', onLogout, onProfileClick, onSettingsClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleProfileClick = () => {
    setIsOpen(false);
    onProfileClick?.();
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    onSettingsClick?.();
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    onLogout?.();
  };

  return (
    <div className="relative hidden md:block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-[var(--surface-2)]',
          colorTransition,
          buttonHoverColor,
          focusStateSmooth
        )}
      >
        <div className="w-6 h-6 rounded-full bg-[var(--brand-primary)] flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-medium text-[var(--text-high)] hidden lg:block">{userName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] hidden lg:block" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] shadow-lg z-50">
          <div className="p-2 space-y-1">
            <button
              onClick={handleProfileClick}
              className={cn('w-full px-3 py-2 text-left text-sm text-[var(--text-high)] hover:bg-[var(--surface-3)] rounded', colorTransition, focusStateSmooth)}
            >
              Profile
            </button>
            <button
              onClick={handleSettingsClick}
              className={cn('w-full px-3 py-2 text-left text-sm text-[var(--text-high)] hover:bg-[var(--surface-3)] rounded', colorTransition, focusStateSmooth)}
            >
              Settings
            </button>
            <div className="h-px bg-[var(--border-hairline)] my-1" />
            <button
              onClick={handleLogoutClick}
              className={cn('w-full px-3 py-2 text-left text-sm text-[var(--accent-negative)] hover:bg-[var(--surface-3)] rounded', colorTransition, focusStateSmooth)}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * TabButton - Navigation tab component
 */
interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 md:px-4 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-[var(--brand-primary)] text-white shadow-sm'
          : 'text-[var(--text-med)] hover:text-[var(--text-high)] hover:bg-[var(--surface-2)]',
        colorTransition
      )}
    >
      {label}
    </button>
  );
};

export const TraderHeader: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [scannerHealthy, setScannerHealthy] = useState(false);

  const activeTrades = useTradeStore((s) => s.activeTrades);
  const challenges = useSettingsStore((s) => s.challenges);
  const watchlist = useMarketStore((s) => s.watchlist);
  const enrichedSession = useEnrichedMarketSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  // Get WebSocket and market data store state
  const wsStatus = useMarketDataStore((state) => state.wsConnection.status);
  const wsConnected = wsStatus === 'connected' || wsStatus === 'authenticated';
  const marketStatus = useMarketDataStore((state) => state.marketStatus);
  const symbols = useMarketDataStore((state) => state.symbols);

  // Calculate LiveStatusBar stats
  const liveStats = useMemo(() => {
    const symbolsList = Object.values(symbols);
    const totalSymbols = symbolsList.length;

    // Count all active strategy signals
    const activeSetups = symbolsList.reduce((count, symbolData) => {
      const activeSignals = symbolData.strategySignals?.filter(s => s.status === 'ACTIVE') || [];
      return count + activeSignals.length;
    }, 0);

    // Calculate average data delay
    const now = Date.now();
    const delays = symbolsList
      .filter(s => s.lastUpdated > 0)
      .map(s => (now - s.lastUpdated) / 1000);

    const avgDelay = delays.length > 0
      ? delays.reduce((sum, d) => sum + d, 0) / delays.length
      : 0;

    return { totalSymbols, activeSetups, avgDelay };
  }, [symbols]);

  // Format market status text
  const marketStatusText = useMemo(() => {
    switch (marketStatus) {
      case 'premarket': return 'Pre-market';
      case 'open': return 'Market open';
      case 'afterhours': return 'After hours';
      case 'closed': return 'Market closed';
      default: return 'Unknown';
    }
  }, [marketStatus]);

  // Format delay
  const delayText = liveStats.avgDelay < 1
    ? `${(liveStats.avgDelay * 1000).toFixed(0)}ms`
    : `${liveStats.avgDelay.toFixed(1)}s`;

  // Scanner health monitoring
  useEffect(() => {
    const checkScanner = async () => {
      try {
        const res = await fetch('/api/health');
        const health = await res.json();
        setScannerHealthy(health.services.scanner);
      } catch (err) {
        setScannerHealthy(false);
      }
    };

    checkScanner();
    const interval = setInterval(checkScanner, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load theme preference from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode');
    const isDark = savedTheme !== 'light';
    setDarkMode(isDark);

    // Apply theme to HTML element
    if (isDark) {
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  const handleDarkModeToggle = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);

    // Toggle light-mode class on HTML element
    if (newDarkMode) {
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme-mode', 'dark');
    } else {
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme-mode', 'light');
    }

    console.log('[v0] Theme toggled to:', newDarkMode ? 'dark' : 'light');
  };

  const handleProfileClick = () => {
    console.log('[v0] Profile clicked');
    // TODO: Implement profile page
    // navigate('/profile');
  };

  const handleSettingsClick = () => {
    console.log('[v0] Settings clicked');
    navigate('/settings');
  };

  const handleLogout = async () => {
    console.log('[v0] Logout clicked');
    try {
      await signOut();
      // Navigation to auth page will happen automatically via AuthContext
      console.log('[v0] Logged out successfully');
    } catch (error) {
      console.error('[v0] Logout error:', error);
    }
  };

  const handleRadarClick = () => {
    console.log('[v0] Radar clicked');
    navigate('/radar');
  };

  const handleMonitoringClick = () => {
    console.log('[v0] Monitoring clicked');
    navigate('/monitoring');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--surface-1)] border-b border-[var(--border-hairline)] backdrop-blur-sm">
      {/* Top Row: Live Status Bar */}
      <div className="px-4 py-1.5 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-3 text-[10px] md:text-xs text-[var(--text-muted)]">
          {/* WebSocket Status */}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-2 h-2 rounded-full transition-colors duration-300',
              wsConnected ? 'bg-[var(--accent-positive)] animate-pulse' : 'bg-[var(--accent-negative)]'
            )} />
            <span className={cn(
              'font-medium',
              wsConnected ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}>
              {wsConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>

          <div className="hidden md:block w-px h-3 bg-[var(--border-hairline)]" />

          {/* Market Status + Delay */}
          <div className="hidden md:flex items-center gap-1.5">
            <span>{marketStatusText}</span>
            <span className="text-[var(--text-faint)]">•</span>
            <span>Delay: <span className={cn(
              'font-medium tabular-nums',
              liveStats.avgDelay < 2 ? 'text-[var(--accent-positive)]' :
              liveStats.avgDelay < 5 ? 'text-amber-400' :
              'text-[var(--accent-negative)]'
            )}>{delayText}</span></span>
          </div>

          <div className="hidden md:block w-px h-3 bg-[var(--border-hairline)]" />

          {/* Scanning */}
          <div className="hidden lg:flex items-center gap-1.5">
            <span>Scanning</span>
            <span className="font-medium text-[var(--text-high)] tabular-nums">{liveStats.totalSymbols}</span>
            <span>symbols</span>
          </div>

          <div className="hidden lg:block w-px h-3 bg-[var(--border-hairline)]" />

          {/* Scanner Status */}
          <div className="hidden lg:flex items-center gap-1.5">
            <Activity className={cn(
              'w-3 h-3',
              scannerHealthy ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )} />
            <span>Scanner: <span className={cn(
              'font-medium',
              scannerHealthy ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
            )}>
              {scannerHealthy ? 'Active' : 'Down'}
            </span></span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Navigation + User Menu */}
      <div className="h-12 px-4 flex items-center justify-between gap-6">
        {/* Left: Mobile Menu (mobile only) */}
        <div className="md:hidden">
          <MobileMenu
            onSettingsClick={handleSettingsClick}
            onRadarClick={handleRadarClick}
            onMonitoringClick={handleMonitoringClick}
            onLogout={handleLogout}
          />
        </div>

        {/* Center: Navigation Tabs (desktop only) */}
        <nav className="hidden md:flex gap-2 lg:gap-3">
          <TabButton
            label="Watch"
            active={location.pathname === '/'}
            onClick={() => navigate('/')}
          />
          <TabButton
            label="Radar"
            active={location.pathname === '/radar'}
            onClick={() => navigate('/radar')}
          />
          <TabButton
            label="Review"
            active={location.pathname === '/history'}
            onClick={() => navigate('/history')}
          />
        </nav>

        {/* Right: Theme Toggle + User Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDarkModeToggle}
            className={cn(
              'w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors',
              colorTransition,
              buttonHoverColor,
              focusStateSmooth
            )}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <Moon className="w-4 h-4 text-[var(--text-high)]" />
            ) : (
              <Sun className="w-4 h-4 text-[var(--text-high)]" />
            )}
          </button>

          {/* User menu (desktop only, has its own mobile handling) */}
          <UserMenu
            userName="Trader"
            onLogout={handleLogout}
            onProfileClick={handleProfileClick}
            onSettingsClick={handleSettingsClick}
          />
        </div>
      </div>
    </header>
  );
};

export default TraderHeader;
