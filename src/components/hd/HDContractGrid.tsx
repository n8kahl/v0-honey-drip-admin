import { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react';
import { Contract } from '../../types';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useOptionTrades, useOptionQuote } from '../../hooks/useOptionsAdvanced';
import { HDConfluenceChips } from './HDConfluenceChips';
import { VariableSizeList as List } from 'react-window';

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
  
  // Auto-expand first date on initial load, but allow collapse. Sync when sortedDates changes.
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  useEffect(() => {
    if (!expandedDate && sortedDates.length > 0) {
      setExpandedDate(sortedDates[0]);
    }
  }, [sortedDates]);
  
  const handleSelect = (contract: Contract) => {
    setSelectedId(contract.id);
    onContractSelect?.(contract);
  };
  
  // Determine if a contract is ITM, ATM, or OTM
  const getContractStatus = useCallback((contract: Contract) => {
    const strikeIncrement = currentPrice > 100 ? 5 : 2.5;
    const diff = Math.abs(contract.strike - currentPrice);
    
    if (diff < strikeIncrement / 2) return 'atm' as const;
    
    if (contract.type === 'C') {
      return contract.strike < currentPrice ? ('itm' as const) : ('otm' as const);
    } else {
      return contract.strike > currentPrice ? ('itm' as const) : ('otm' as const);
    }
  }, [currentPrice]);
  
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
          const status = getContractStatus(c);
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
  
  // Row height map for variable-size list
  const rowHeights = useRef<Record<number, number>>({});
  const listRef = useRef<List>(null);
  
  const getRowHeight = useCallback((index: number) => {
    const cached = rowHeights.current[index];
    if (cached !== undefined) return cached;
    
    const row = virtualRows[index];
    if (!row) return 40;
    if (row.type === 'dateHeader') return 32;
    if (row.type === 'atmIndicator') return 32;
    if (row.type === 'itmLabel') return 24;
    if (row.type === 'contract') return 32;
    return 32;
  }, [virtualRows]);
  
  const setRowHeight = useCallback((index: number, height: number) => {
    if (height !== rowHeights.current[index]) {
      rowHeights.current[index] = height;
      if (listRef.current) {
        listRef.current.resetAfterIndex(index);
      }
    }
  }, []);
  
  return (
    <div className={cn('flex flex-col h-full bg-[var(--surface-1)]', className)}>
      {/* Top Controls - Calls/Puts Toggle */}
      <div className="flex gap-2 p-3 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
        <button
          onClick={() => setOptionType('C')}
          className={cn(
            'flex-1 h-8 text-xs font-medium rounded-[var(--radius)] transition-all flex items-center justify-center',
            optionType === 'C'
              ? 'bg-[var(--brand-primary)] text-[var(--bg-base)] shadow-sm'
              : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] border border-[var(--border-hairline)]'
          )}
        >
          Calls
        </button>
        <button
          onClick={() => setOptionType('P')}
          className={cn(
            'flex-1 h-8 text-xs font-medium rounded-[var(--radius)] transition-all flex items-center justify-center',
            optionType === 'P'
              ? 'bg-[var(--brand-primary)] text-[var(--bg-base)] shadow-sm'
              : 'bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text-high)] hover:bg-[var(--surface-3)] border border-[var(--border-hairline)]'
          )}
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
      
      {/* Scrollable Contract List - Single unified scroll container */}
      <div className="flex-1 overflow-y-auto overflow-x-auto scrollbar-thin relative">
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
                const status = getContractStatus(c);
                if (status === 'atm') atmContracts.push(c);
                else if (status === 'itm') itmContracts.push(c);
                else otmContracts.push(c);
              });
              
              // Track row index for zebra striping
              let rowIndex = 0;
              
              return (
                <div key={dateKey}>
                  {/* Date Header - Full width, sticky to prevent horizontal scroll */}
                  <button
                    className="sticky left-0 w-full flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--border-hairline)] text-[11px] text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium z-20"
                    onClick={() => setExpandedDate(isExpanded ? null : dateKey)}
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
                      {/* OTM Contracts */}
                      {otmContracts.map((contract) => {
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
                      {atmContracts.length > 0 && (
                        <>
                          <div className="sticky left-0 flex items-center justify-center py-1.5 bg-[var(--surface-2)] border-y border-[var(--border-hairline)] z-20">
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
                          {atmContracts.map((contract) => {
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
                      {itmContracts.length > 0 && (
                        <div className="sticky left-0 flex items-center gap-2 px-3 py-1 bg-[var(--surface-1)] border-t border-[var(--border-hairline)] z-20">
                          <span className="text-[10px] text-[var(--text-muted)]">▼ ITM</span>
                        </div>
                      )}
                      
                      {/* ITM Contracts */}
                      {itmContracts.map((contract) => {
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

function ContractRow({ 
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
}
