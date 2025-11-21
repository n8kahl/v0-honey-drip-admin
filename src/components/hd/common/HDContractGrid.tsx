import { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react';
import { Contract } from '../../types';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useOptionTrades, useOptionQuote } from '../../hooks/useOptionsAdvanced';
import { HDConfluenceChips } from '../signals/HDConfluenceChips';

type VirtualRow = 
  | { type: 'dateHeader'; dateKey: string; daysToExpiry: number; contractCount: number }
  | { type: 'contract'; contract: Contract; status: 'otm' | 'atm' | 'itm'; dateKey: string }
  | { type: 'atmIndicator'; ticker: string; currentPrice: number; dateKey: string }
  | { type: 'itmLabel'; dateKey: string };

interface HDContractGridProps {
  contracts: Contract[];
  currentPrice: number;
  ticker: string;
  onContractSelect?: (contract: Contract) => void;
  className?: string;
}

export function HDContractGrid({ contracts, currentPrice, ticker, onContractSelect, className }: HDContractGridProps) {
  const __DEV__ = typeof window !== 'undefined' && (import.meta as any)?.env?.DEV;

  if (__DEV__) console.debug('[v0] HDContractGrid rendering with', contracts.length, 'contracts');

  const [optionType, setOptionType] = useState<'C' | 'P'>('P');
  const [selectedId, setSelectedId] = useState<string>();
  // Filter by option type (memoized)
  const filtered = useMemo(() => contracts.filter((c) => c.type === optionType), [contracts, optionType]);

  if (__DEV__) console.debug('[v0] Filtered contracts:', filtered.length, 'for type', optionType);

  // Group by expiry date (memoized)
  const groupedByDate = useMemo(() => {
    const acc: Record<string, Contract[]> = {};
    for (const contract of filtered) {
      const key = contract.expiry;
      if (!acc[key]) acc[key] = [];
      acc[key].push(contract);
    }
    // Sort each group by strike
    Object.keys(acc).forEach((k) => acc[k].sort((a, b) => a.strike - b.strike));
    return acc;
  }, [filtered]);

  // Sort expiry dates chronologically (memoized)
  const sortedDates = useMemo(() => {
    return Object.keys(groupedByDate).sort((a, b) => {
      const contractA = groupedByDate[a][0];
      const contractB = groupedByDate[b][0];
      return (contractA?.daysToExpiry || 0) - (contractB?.daysToExpiry || 0);
    });
  }, [groupedByDate]);
  
  // Find the ATM strike (closest to current price) for each expiry
  const atmStrikes = useMemo(() => {
    const strikeMap = new Map<string, number>(); // dateKey -> ATM strike
    
    for (const dateKey of sortedDates) {
      const contracts = groupedByDate[dateKey];
      if (!contracts || contracts.length === 0) continue;
      
      // Find the strike closest to current price
      let closestStrike = contracts[0].strike;
      let minDiff = Math.abs(contracts[0].strike - currentPrice);
      
      for (const c of contracts) {
        const diff = Math.abs(c.strike - currentPrice);
        if (diff < minDiff) {
          minDiff = diff;
          closestStrike = c.strike;
        }
      }
      
      strikeMap.set(dateKey, closestStrike);
    }
    
    return strikeMap;
  }, [groupedByDate, sortedDates, currentPrice]);

  // Auto-expand nearest (first) expiration on ticker change only
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  useEffect(() => {
    if (sortedDates.length > 0) {
      setExpandedDate(sortedDates[0]);
    }
  }, [ticker]);
  
  const handleSelect = (contract: Contract) => {
    setSelectedId(contract.id);
    onContractSelect?.(contract);
  };

  // Determine if a contract is ITM, ATM, or OTM
  const getContractStatus = useCallback((contract: Contract, dateKey: string) => {
    // Check if this strike is the ATM strike for this expiry
    const atmStrike = atmStrikes.get(dateKey);
    if (contract.strike === atmStrike) return 'atm' as const;
    
    if (contract.type === 'C') {
      return contract.strike < currentPrice ? ('itm' as const) : ('otm' as const);
    } else {
      return contract.strike > currentPrice ? ('itm' as const) : ('otm' as const);
    }
  }, [currentPrice, atmStrikes]);
  
  // Build flattened virtualized rows from hierarchical data
  const virtualRows = useMemo(() => {
    if (!expandedDate) return [];
    
    const rows: VirtualRow[] = [];
    for (const dateKey of sortedDates) {
      const contracts = groupedByDate[dateKey];
      const firstContract = contracts[0];
      const isExpanded = expandedDate === dateKey;
      
      // Add date header
      rows.push({
        type: 'dateHeader',
        dateKey,
        daysToExpiry: firstContract?.daysToExpiry || 0,
        contractCount: contracts.length,
      });
      
      if (isExpanded) {
        // Split contracts
        const otmContracts: Contract[] = [];
        const atmContracts: Contract[] = [];
        const itmContracts: Contract[] = [];
        
        contracts.forEach((c: Contract) => {
          const status = getContractStatus(c, dateKey);
          if (status === 'atm') atmContracts.push(c);
          else if (status === 'itm') itmContracts.push(c);
          else otmContracts.push(c);
        });
        
        // Add OTM contracts
        otmContracts.forEach((c) => {
          rows.push({ type: 'contract', contract: c, status: 'otm', dateKey });
        });
        
        // Add ATM indicator and contracts
        if (atmContracts.length > 0) {
          rows.push({ type: 'atmIndicator', ticker, currentPrice, dateKey });
          atmContracts.forEach((c) => {
            rows.push({ type: 'contract', contract: c, status: 'atm', dateKey });
          });
        }
        
        // Add ITM label and contracts
        if (itmContracts.length > 0) {
          rows.push({ type: 'itmLabel', dateKey });
          itmContracts.forEach((c) => {
            rows.push({ type: 'contract', contract: c, status: 'itm', dateKey });
          });
        }
      }
    }
    
    return rows;
  }, [sortedDates, groupedByDate, expandedDate, getContractStatus, ticker, currentPrice]);
  
  // (Virtualization scaffolding removed; not currently used)
  
  return (
    <div 
      className={cn('flex flex-col h-full bg-[var(--surface-1)]', className)}
      data-testid="options-chain-panel"
    >
      {/* Underlying symbol and price header */}
      <div className="px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-2)] flex items-center justify-between">
        <span 
          className="text-sm font-semibold text-[var(--text-high)]"
          data-testid="chain-underlying-symbol"
        >
          {ticker}
        </span>
        <span 
          className="text-sm text-[var(--text-med)]"
          data-testid="underlying-price"
        >
          ${currentPrice.toFixed(2)}
        </span>
      </div>
      
      {/* Top Controls - Calls/Puts Toggle */}
      <div className="flex gap-2 p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <button
          onClick={() => setOptionType('C')}
          className={cn(
            'flex-1 h-8 text-xs font-medium rounded-[var(--radius)] transition-all flex items-center justify-center',
            optionType === 'C'
              ? 'bg-[var(--accent-positive)]/20 text-[var(--accent-positive)] border border-[var(--accent-positive)]/30 shadow-sm'
              : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] border border-[var(--border-hairline)]'
          )}
          data-testid="contract-type-calls"
        >
          Calls
        </button>
        <button
          onClick={() => setOptionType('P')}
          className={cn(
            'flex-1 h-8 text-xs font-medium rounded-[var(--radius)] transition-all flex items-center justify-center',
            optionType === 'P'
              ? 'bg-[var(--accent-negative)]/20 text-[var(--accent-negative)] border border-[var(--accent-negative)]/30 shadow-sm'
              : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] border border-[var(--border-hairline)]'
          )}
          data-testid="contract-type-puts"
        >
          Puts
        </button>
      </div>
      
      {/* Column Headers - Fixed Strike + Scrollable Data */}
      <div className="border-b border-[var(--border-hairline)] bg-[var(--surface-1)] overflow-x-auto scrollbar-thin">
        <div className="flex min-w-max">
          {/* Sticky Strike Header */}
          <div className="sticky left-0 z-10 w-[70px] lg:w-[80px] flex-shrink-0 px-3 py-2 text-micro text-[var(--text-faint)] uppercase tracking-wide font-medium bg-[var(--surface-1)] border-r border-[var(--border-hairline)]">
            Strike
          </div>
          {/* Scrollable Headers */}
          <div className="grid grid-cols-[60px_60px_60px_80px_80px] lg:grid-cols-[70px_70px_70px_90px_90px] gap-2 px-3 py-2 text-micro text-[var(--text-faint)] uppercase tracking-wide font-medium">
            <div>Bid</div>
            <div>Ask</div>
            <div>Last</div>
            <div>Open Int</div>
            <div>Impl. Vol.</div>
          </div>
        </div>
      </div>

      {/* Selected Expiration Marker for tests/UI clarity */}
      {expandedDate && (
        <div className="px-3 py-1 text-[11px] text-[var(--text-muted)] bg-[var(--surface-1)] border-b border-[var(--border-hairline)]">
          <span className="mr-2 text-[var(--text-faint)]">Selected Expiration:</span>
          <span data-testid="selected-expiration">{expandedDate}</span>
        </div>
      )}
      
      {/* Scrollable Contract List - Single unified scroll container */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin relative"
        data-testid="strike-grid"
      >
        {sortedDates.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
            No {optionType === 'C' ? 'calls' : 'puts'} available
          </div>
        ) : (
          <div className="min-w-max">
            {sortedDates.map((dateKey, dateIdx) => {
              const contracts = groupedByDate[dateKey];
              const firstContract = contracts[0];
              const isExpanded = expandedDate === dateKey;
              
              // Split into OTM and ITM
              const otmContracts: Contract[] = [];
              const atmContracts: Contract[] = [];
              const itmContracts: Contract[] = [];
              
              contracts.forEach(c => {
                const status = getContractStatus(c, dateKey);
                if (status === 'atm') atmContracts.push(c);
                else if (status === 'itm') itmContracts.push(c);
                else otmContracts.push(c);
              });

              // Limit displayed strikes per spec: 10 OTM + 1 ATM + 10 ITM (nearest to ATM)
              // We keep internal full arrays for potential future analytics but slice for UI density.
              const atmStrike = atmStrikes.get(dateKey);
              // Helper to select closest N by absolute distance to ATM strike
              const limitClosest = (arr: Contract[], limit: number) => {
                if (!atmStrike || arr.length <= limit) return arr;
                return [...arr]
                  .sort((a, b) => Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike))
                  .slice(0, limit)
                  .sort((a, b) => a.strike - b.strike); // re-sort for ascending strike display
              };

              const limitedOtm = limitClosest(otmContracts, 10);
              const limitedItm = limitClosest(itmContracts, 10);
              // ATM should only ever be a single strike; if multiple due to data quirks we take the one closest to current price.
              const limitedAtm = atmContracts.length <= 1
                ? atmContracts
                : atmContracts
                    .sort((a, b) => Math.abs(a.strike - currentPrice) - Math.abs(b.strike - currentPrice))
                    .slice(0, 1);

              
              // Track row index for zebra striping
              let rowIndex = 0;
              
              return (
                <div key={dateKey}>
                  {/* Date Header - Full width, sticky to prevent horizontal scroll */}
                  <button
                    className="sticky left-0 w-full flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border-hairline)] text-[11px] text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium z-20"
                    onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
                    data-testid={`expiry-option-${dateKey}`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={12} className="text-[var(--text-muted)]" />
                    ) : (
                      <ChevronRight size={12} className="text-[var(--text-muted)]" />
                    )}
                    <span>{dateKey}</span>
                    <span className="text-[var(--text-muted)] font-normal">({firstContract.daysToExpiry}D)</span>
                  </button>
                  
                  {/* Only show contracts if this date is expanded */}
                  {isExpanded && (
                    <>
                      {/* OTM Contracts (limited to 10) */}
                      {limitedOtm.map((contract) => {
                        const currentRow = rowIndex++;
                        return (
                          <ContractRow
                            key={contract.id}
                            contract={contract}
                            status="otm"
                            selected={contract.id === selectedId}
                            onClick={() => handleSelect(contract)}
                            zebra={currentRow % 2 === 1}
                          />
                        );
                      })}
                      
                      {/* ATM Indicator - Full width, sticky to prevent horizontal scroll */}
                      {limitedAtm.length > 0 && (
                        <>
                          <div 
                            className="sticky left-0 flex items-center justify-center py-1.5 bg-[var(--surface-2)] border-y border-[var(--border-hairline)] z-20"
                            data-testid="atm-separator"
                          >
                            <div className="flex items-center gap-2 px-3 py-0.5 bg-[var(--surface-1)] rounded-sm">
                              <span className="text-[10px] text-[var(--text-muted)]">▼</span>
                              <span className="text-xs">{ticker}</span>
                              <span className={cn(
                                "text-xs",
                                currentPrice > 0 ? "text-[var(--accent-positive)]" : "text-[var(--accent-negative)]"
                              )}>
                                {currentPrice.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)]">▼</span>
                            </div>
                          </div>
                          {limitedAtm.map((contract) => {
                            const currentRow = rowIndex++;
                            return (
                              <ContractRow
                                key={contract.id}
                                contract={contract}
                                status="atm"
                                selected={contract.id === selectedId}
                                onClick={() => handleSelect(contract)}
                                zebra={currentRow % 2 === 1}
                              />
                            );
                          })}
                        </>
                      )}
                      
                      {/* ITM Label - Full width, sticky to prevent horizontal scroll */}
                      {limitedItm.length > 0 && (
                        <div className="sticky left-0 flex items-center gap-2 px-3 py-1 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] z-20">
                          <span className="text-[10px] text-[var(--text-muted)]">▼ ITM</span>
                        </div>
                      )}
                      
                      {/* ITM Contracts (limited to 10) */}
                      {limitedItm.map((contract) => {
                        const currentRow = rowIndex++;
                        return (
                          <ContractRow
                            key={contract.id}
                            contract={contract}
                            status="itm"
                            selected={contract.id === selectedId}
                            onClick={() => handleSelect(contract)}
                            zebra={currentRow % 2 === 1}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const ContractRow = memo(function ContractRow({ 
  contract, 
  status, 
  selected, 
  onClick,
  zebra 
}: { 
  contract: Contract; 
  status: 'otm' | 'atm' | 'itm'; 
  selected: boolean; 
  onClick: () => void;
  zebra: boolean;
}) {
  const { tradeTape } = useOptionTrades(selected ? contract.id : null);
  
  return (
    <div className="relative">
      <button
        className={cn(
          'w-full flex border-b border-[var(--border-hairline)] transition-colors hover:bg-[var(--surface-3)]',
          !selected && zebra && 'bg-[var(--zebra-stripe)]',
          status === 'itm' && !selected && 'bg-[var(--itm-background)]',
          status === 'atm' && !selected && 'bg-[var(--surface-2)]',
          selected && 'bg-[var(--surface-3)] ring-1 ring-[var(--brand-primary)]'
        )}
        onClick={onClick}
        data-testid="contract-row"
        data-strike={contract.strike}
        data-exp={contract.expiry}
        data-moneyness={status}
      >
        {/* Sticky Strike Column */}
        <div className="sticky left-0 z-10 w-[70px] lg:w-[80px] flex-shrink-0 px-3 py-2 text-xs text-[var(--text-high)] bg-inherit border-r border-[var(--border-hairline)] text-left">
          ${contract.strike}
        </div>
        {/* Scrollable Data Columns */}
        <div className="grid grid-cols-[60px_60px_60px_80px_80px] lg:grid-cols-[70px_70px_70px_90px_90px] gap-2 px-3 py-2 text-xs">
          <div className="text-[var(--accent-positive)]">{contract.bid.toFixed(2)}</div>
          <div className="text-[var(--accent-negative)]">{contract.ask.toFixed(2)}</div>
          <div className="text-[var(--text-high)]">{contract.mid.toFixed(2)}</div>
          <div className="text-[var(--text-muted)]">{contract.openInterest.toLocaleString()}</div>
          <div className="text-[var(--text-muted)]">{contract.iv?.toFixed(2)}%</div>
        </div>
      </button>
      
      {selected && tradeTape && (
        <div className="px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-hairline)]">
          <HDConfluenceChips tradeTape={tradeTape} />
        </div>
      )}
    </div>
  );
});
