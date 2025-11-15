import { SessionStatus } from '../../types';
import { HDPill } from './HDPill';
import { Settings, Mic, User, LogOut, WifiOff, Wifi } from 'lucide-react';
import { cn } from '../../lib/utils';
const honeyDripLogo = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hdn-l492QBW7lTUL3waoOAnhU3p8Ep7YNp.png';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { useMarketDataConnection } from '../../hooks/useMassiveData';
import { massiveClient } from '../../lib/massive/client';
import { useStreamingIndex } from '../../hooks/useIndicesAdvanced';

export type VoiceState = 'idle' | 'listening' | 'processing';

interface HDHeaderProps {
  sessionStatus: SessionStatus;
  voiceState?: VoiceState;
  onSettingsClick?: () => void;
  onMicClick?: () => void;
  className?: string;
}

export function HDHeader({
  sessionStatus,
  voiceState = 'idle',
  onSettingsClick,
  onMicClick,
  className
}: HDHeaderProps) {
  const { signOut, user } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const { quote: spxQuote } = useStreamingIndex('SPX');
  const { quote: vixQuote } = useStreamingIndex('VIX');
  
  const [marketStatus, setMarketStatus] = useState<{
    status: 'open' | 'closed' | 'pre-market' | 'after-hours';
    time: string;
  } | null>(null);
  
  const { isConnected, hasApiKey, lastError } = useMarketDataConnection();

  useEffect(() => {
    const fetchMarketStatus = async () => {
      try {
        const data = await massiveClient.getMarketStatus();
        
        let status: 'open' | 'closed' | 'pre-market' | 'after-hours' = 'closed';
        if (data.market === 'open') {
          status = 'open';
        } else if (data.earlyHours) {
          status = 'pre-market';
        } else if (data.afterHours) {
          status = 'after-hours';
        }
        
        const serverTime = new Date(data.serverTime);
        const etTime = serverTime.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        
        setMarketStatus({ status, time: `${etTime} ET` });
      } catch (error) {
        console.error('[v0] Failed to fetch market status:', error);
      }
    };
    
    fetchMarketStatus();
    
    const interval = setInterval(fetchMarketStatus, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getConnectionStatus = () => {
    if (!isConnected) {
      return {
        label: 'DISCONNECTED',
        tooltip: lastError || 'Unable to connect to market data API',
        color: 'red',
        icon: WifiOff
      };
    }
    return {
      label: 'LIVE DATA',
      tooltip: 'Connected to live market data',
      color: 'green',
      icon: Wifi
    };
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;
  
  const getMarketStatusDisplay = () => {
    if (!marketStatus) return null;
    
    const statusColors = {
      'open': 'text-green-500',
      'closed': 'text-red-500',
      'pre-market': 'text-yellow-500',
      'after-hours': 'text-blue-500',
    };
    
    const statusLabels = {
      'open': 'Open',
      'closed': 'Closed',
      'pre-market': 'Pre-Market',
      'after-hours': 'After-Hours',
    };
    
    return {
      label: statusLabels[marketStatus.status],
      time: marketStatus.time,
      color: statusColors[marketStatus.status],
    };
  };
  
  const marketDisplay = getMarketStatusDisplay();

  return (
    <header
      className={cn(
        'flex items-center justify-between px-3 lg:px-6 h-16 lg:h-14 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]',
        className
      )}
    >
      <div className="flex items-center gap-2 lg:gap-3 min-w-0">
        <img src={honeyDripLogo || "/placeholder.svg"} alt="Honey Drip" className="w-9 h-9 lg:w-8 lg:h-8 rounded flex-shrink-0" />
        <h1 className="text-[var(--text-high)] font-semibold tracking-tight text-sm lg:text-base truncate">
          <span className="hidden lg:inline">Honey Drip Admin</span>
          <span className="lg:hidden">Honey Drip</span>
        </h1>
      </div>
      
      <div className="flex items-center justify-center gap-2 flex-shrink-0 mx-2">
        {spxQuote && (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <span className="text-xs font-medium text-[var(--text-muted)]">SPX</span>
            <span className="text-xs font-medium text-[var(--text-high)]">
              {spxQuote.value.toFixed(2)}
            </span>
            <span className={cn(
              "text-xs font-medium",
              spxQuote.changePercent > 0 ? "text-green-500" : "text-red-500"
            )}>
              {spxQuote.changePercent > 0 ? '+' : ''}{spxQuote.changePercent.toFixed(2)}%
            </span>
          </div>
        )}
        
        {vixQuote && (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <span className="text-xs font-medium text-[var(--text-muted)]">VIX</span>
            <span className="text-xs font-medium text-[var(--text-high)]">
              {vixQuote.value.toFixed(2)}
            </span>
          </div>
        )}
        
        {marketDisplay && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border-hairline)]">
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", marketDisplay.color)} />
              <span className={cn("text-xs font-medium", marketDisplay.color)}>
                {marketDisplay.label}
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {marketDisplay.time}
            </span>
          </div>
        )}
        
        <div 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full border",
            connectionStatus.color === 'yellow' && "bg-yellow-500/10 border-yellow-500/20",
            connectionStatus.color === 'red' && "bg-red-500/10 border-red-500/20",
            connectionStatus.color === 'green' && "bg-green-500/10 border-green-500/20"
          )}
          title={connectionStatus.tooltip}
        >
          <StatusIcon className={cn(
            "w-3 h-3",
            connectionStatus.color === 'yellow' && "text-yellow-500",
            connectionStatus.color === 'red' && "text-red-500",
            connectionStatus.color === 'green' && "text-green-500"
          )} />
          <span className={cn(
            "text-[10px] font-medium hidden lg:inline",
            connectionStatus.color === 'yellow' && "text-yellow-500",
            connectionStatus.color === 'red' && "text-red-500",
            connectionStatus.color === 'green' && "text-green-500"
          )}>
            {connectionStatus.label}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
        <button
          onClick={onMicClick}
          className={cn(
            'relative h-8 w-8 lg:w-auto lg:px-3 flex items-center justify-center gap-2 rounded-[var(--radius)] transition-all',
            voiceState === 'idle' && 'bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)]',
            voiceState === 'listening' && 'bg-[var(--brand-primary)] text-[var(--bg-base)] shadow-lg',
            voiceState === 'processing' && 'bg-[var(--brand-primary)]/80 text-[var(--bg-base)]'
          )}
          aria-label="Voice command"
          title={voiceState === 'idle' ? 'Voice commands (press M)' : voiceState === 'listening' ? 'Listening...' : 'Processing...'}
        >
          {voiceState === 'listening' && (
            <div className="absolute inset-0 rounded-[var(--radius)] animate-ping">
              <div className="w-full h-full rounded-[var(--radius)] bg-[var(--brand-primary)] opacity-40" />
            </div>
          )}
          
          <Mic className={cn(
            'w-3.5 h-3.5 relative z-10',
            voiceState === 'listening' && 'animate-pulse'
          )} />
          <span className="hidden lg:inline text-xs font-medium relative z-10">Voice</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-[var(--brand-primary)] text-white font-medium text-xs hover:opacity-90 transition-opacity"
            aria-label="Profile menu"
          >
            {user?.email?.substring(0, 2).toUpperCase()}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] shadow-xl py-1 z-50">
              <div className="px-3 py-2 border-b border-[var(--border-hairline)]">
                <div className="text-[var(--text-high)] text-sm font-medium truncate">
                  {user?.email}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onSettingsClick?.();
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-med)] hover:bg-[var(--surface-2)] hover:text-[var(--text-high)] transition-colors flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Profile & Settings
              </button>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  signOut();
                }}
                className="w-full px-3 py-2 text-left text-sm text-[var(--text-med)] hover:bg-[var(--surface-2)] hover:text-[var(--text-high)] transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
