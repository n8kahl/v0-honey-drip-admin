import { useState } from 'react';
import { Ticker, Trade, TradeState } from '../types';
import { HDRowWatchlist } from './hd/HDRowWatchlist';
import { MobileNowPlaying } from './MobileNowPlaying';
import { HDContractGrid } from './hd/HDContractGrid';
import { HDMobileSparklinePreview } from './hd/HDMobileSparklinePreview';
import { HDMobileChartModal } from './hd/HDMobileChartModal';
import { Plus } from 'lucide-react';
import { useMassiveData } from '../hooks/useMassiveData';
import { toast } from 'sonner';

interface MobileLiveProps {
  watchlist: Ticker[];
  onTickerClick: (ticker: Ticker) => void;
  onRemoveTicker?: (ticker: Ticker) => void;
}

export function MobileLive({ watchlist, onTickerClick, onRemoveTicker }: MobileLiveProps) {
  const [activeTicker, setActiveTicker] = useState<Ticker | null>(null);
  const [showContracts, setShowContracts] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>('WATCHING');
  const [showChartModal, setShowChartModal] = useState(false);
  
  const { fetchOptionsChain } = useMassiveData();
  
  const handleTickerClick = async (ticker: Ticker) => {
    setActiveTicker(ticker);
    setTradeState('WATCHING');
    setCurrentTrade(null);
    setShowContracts(true);
    setContractsLoading(true);
    onTickerClick(ticker);
    
    try {
      console.log('[v0] Mobile: Fetching real options chain for', ticker.symbol);
      const realContracts = await fetchOptionsChain(ticker.symbol);
      console.log('[v0] Mobile: Received', realContracts.length, 'contracts');
      setContracts(realContracts);
    } catch (error) {
      console.error('[v0] Mobile: Failed to fetch options chain:', error);
      toast.error('Failed to load options chain');
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };
  
  const handleContractSelect = (contract: any) => {
    if (!activeTicker) return;
    
    const trade: Trade = {
      id: `trade-${Date.now()}`,
      ticker: activeTicker.symbol,
      contract,
      tradeType: 'Day',
      state: 'LOADED',
      updates: [],
      discordChannels: [],
      challenges: [],
    };
    setCurrentTrade(trade);
    setTradeState('LOADED');
    setShowContracts(false);
  };
  
  const handleEnter = () => {
    if (!currentTrade) return;
    
    const enteredTrade: Trade = {
      ...currentTrade,
      state: 'ENTERED',
      entryPrice: currentTrade.contract.mid,
      entryTime: new Date(),
      currentPrice: currentTrade.contract.mid,
      targetPrice: currentTrade.contract.mid * 1.5,
      stopLoss: currentTrade.contract.mid * 0.85,
      movePercent: 0,
      updates: [{
        id: '1',
        type: 'enter',
        timestamp: new Date(),
        message: `Entering ${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type} at mid $${currentTrade.contract.mid.toFixed(2)}`,
        price: currentTrade.contract.mid,
      }],
    };
    setCurrentTrade(enteredTrade);
    setTradeState('ENTERED');
  };
  
  const handleDiscard = () => {
    setCurrentTrade(null);
    setTradeState('WATCHING');
  };
  
  if (showContracts) {
    return (
      <>
        <div className="h-[calc(100vh-4rem-4rem)] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
            <button
              onClick={() => setShowContracts(false)}
              className="text-[var(--brand-primary)]"
            >
              ← Back
            </button>
            <h2 className="text-[var(--text-high)]">{activeTicker?.symbol} Contracts</h2>
            <div className="w-12" />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 bg-[var(--surface-1)]">
              <HDMobileSparklinePreview
                ticker={activeTicker?.symbol || ''}
                currentPrice={activeTicker?.last || 0}
                bars={25}
                onTap={() => setShowChartModal(true)}
              />
            </div>
            
            {contractsLoading ? (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
                Loading contracts…
              </div>
            ) : contracts.length > 0 ? (
              <HDContractGrid
                contracts={contracts}
                currentPrice={activeTicker?.last || 0}
                ticker={activeTicker?.symbol || ''}
                onContractSelect={handleContractSelect}
              />
            ) : (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-sm">
                No contracts available for this ticker.
              </div>
            )}
          </div>
        </div>
        
        <HDMobileChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          ticker={activeTicker?.symbol || ''}
          currentPrice={activeTicker?.last || 0}
          dailyChange={activeTicker?.changePercent || 0}
        />
      </>
    );
  }
  
  return (
    <div className="h-[calc(100vh-4rem-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--surface-1)]">
        <h2 className="text-[var(--text-high)]">Watchlist</h2>
        <button className="w-9 h-9 flex items-center justify-center rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--brand-primary)]">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-[var(--surface-2)]">
        {watchlist.map((ticker) => (
          <HDRowWatchlist
            key={ticker.id}
            ticker={ticker}
            active={ticker.symbol === activeTicker?.symbol}
            onClick={() => handleTickerClick(ticker)}
            onRemove={onRemoveTicker ? () => onRemoveTicker(ticker) : undefined}
          />
        ))}
      </div>
      
      <MobileNowPlaying
        trade={currentTrade}
        ticker={activeTicker?.symbol}
        state={tradeState}
        onEnter={handleEnter}
        onDiscard={handleDiscard}
      />
    </div>
  );
}
