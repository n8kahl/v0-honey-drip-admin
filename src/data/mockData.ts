import { Ticker, Contract, Trade, TradeUpdate } from '../types';
import { inferTradeType } from '../lib/utils';

export const mockTickers: Ticker[] = [
  { id: '1', symbol: 'SPX', last: 4523.12, change: 12.45, changePercent: 2.34 },
  { id: '2', symbol: 'QQQ', last: 387.65, change: -3.21, changePercent: -1.12 },
  { id: '3', symbol: 'SPY', last: 452.88, change: 5.67, changePercent: 1.42 },
  { id: '4', symbol: 'TSLA', last: 242.15, change: 8.92, changePercent: 3.82 },
  { id: '5', symbol: 'NVDA', last: 495.32, change: -2.14, changePercent: -0.43 },
  { id: '6', symbol: 'AAPL', last: 178.45, change: 1.23, changePercent: 0.69 },
];

export function generateMockContracts(symbol: string, currentPrice: number): Contract[] {
  const contracts: Contract[] = [];
  const today = new Date();
  
  // Generate comprehensive expiry dates including LEAPs
  const expiryDates = [
    // 0DTE
    { label: 'Nov 13', days: 0 },
    // 1-2 DTE (Day trades)
    { label: 'Nov 14', days: 1 },
    { label: 'Nov 15', days: 2 },
    // Weekly expirations (3-10 DTE - Swing trades)
    { label: 'Nov 18', days: 5 },
    { label: 'Nov 20', days: 7 },
    { label: 'Nov 22', days: 9 },
    // Monthly expirations
    { label: 'Dec 20', days: 37 },
    { label: 'Jan 17 2026', days: 65 },
    { label: 'Feb 21 2026', days: 100 },
    { label: 'Mar 20 2026', days: 127 },
    { label: 'Apr 17 2026', days: 155 },
    { label: 'Jun 19 2026', days: 218 },
    { label: 'Sep 18 2026', days: 309 },
    { label: 'Dec 18 2026', days: 400 },
    // LEAPs
    { label: 'Jan 21 2027', days: 434 },
    { label: 'Jun 18 2027', days: 582 },
    { label: 'Dec 17 2027', days: 764 },
  ];
  
  let id = 1;
  
  for (const expiry of expiryDates) {
    // Generate more strikes around current price for better visualization
    const strikeIncrement = currentPrice > 100 ? 5 : 2.5;
    const numStrikesEachSide = 8;
    const strikes: number[] = [];
    
    for (let i = -numStrikesEachSide; i <= numStrikesEachSide; i++) {
      strikes.push(currentPrice + (i * strikeIncrement));
    }
    
    for (const strike of strikes) {
      const roundedStrike = Math.round(strike * 2) / 2; // Round to nearest 0.5
      const distanceFromATM = Math.abs(roundedStrike - currentPrice);
      
      // Call
      const callDelta = roundedStrike < currentPrice 
        ? Math.min(0.95, 0.5 + (currentPrice - roundedStrike) / (currentPrice * 0.2))
        : roundedStrike === currentPrice 
        ? 0.5 
        : Math.max(0.05, 0.5 - (roundedStrike - currentPrice) / (currentPrice * 0.2));
        
      const callMid = roundedStrike < currentPrice
        ? (currentPrice - roundedStrike) + Math.random() * 3
        : Math.max(0.5, (3 + Math.random() * 5) * Math.exp(-distanceFromATM / (currentPrice * 0.1)));
      
      contracts.push({
        id: `${id++}`,
        strike: roundedStrike,
        expiry: expiry.label,
        expiryDate: new Date(Date.now() + expiry.days * 24 * 60 * 60 * 1000),
        daysToExpiry: expiry.days,
        type: 'C',
        mid: callMid,
        bid: callMid * 0.95,
        ask: callMid * 1.05,
        volume: Math.floor(Math.random() * 10000) + 100,
        openInterest: Math.floor(Math.random() * 50000) + 500,
        delta: callDelta,
        gamma: 0.05,
        theta: -0.12,
        vega: 0.08,
        iv: 35 + Math.random() * 20,
      });
      
      // Put
      const putDelta = roundedStrike > currentPrice
        ? Math.max(-0.95, -0.5 - (roundedStrike - currentPrice) / (currentPrice * 0.2))
        : roundedStrike === currentPrice
        ? -0.5
        : Math.min(-0.05, -0.5 + (currentPrice - roundedStrike) / (currentPrice * 0.2));
        
      const putMid = roundedStrike > currentPrice
        ? (roundedStrike - currentPrice) + Math.random() * 3
        : Math.max(0.5, (3 + Math.random() * 5) * Math.exp(-distanceFromATM / (currentPrice * 0.1)));
      
      contracts.push({
        id: `${id++}`,
        strike: roundedStrike,
        expiry: expiry.label,
        expiryDate: new Date(Date.now() + expiry.days * 24 * 60 * 60 * 1000),
        daysToExpiry: expiry.days,
        type: 'P',
        mid: putMid,
        bid: putMid * 0.95,
        ask: putMid * 1.05,
        volume: Math.floor(Math.random() * 10000) + 100,
        openInterest: Math.floor(Math.random() * 50000) + 500,
        delta: putDelta,
        gamma: 0.05,
        theta: -0.12,
        vega: 0.08,
        iv: 35 + Math.random() * 20,
      });
    }
  }
  
  return contracts;
}

export function createMockTrade(
  ticker: string,
  contract: Contract,
  state: 'LOADED' | 'ENTERED' = 'LOADED'
): Trade {
  const tradeType = inferTradeType(contract.daysToExpiry);
  const entryPrice = state === 'ENTERED' ? contract.mid : undefined;
  const currentPrice = state === 'ENTERED' ? contract.mid * (1 + (Math.random() - 0.3) * 0.3) : undefined;
  const movePercent = entryPrice && currentPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : undefined;
  
  const updates: TradeUpdate[] = state === 'ENTERED' ? [
    {
      id: '1',
      type: 'enter',
      timestamp: new Date(Date.now() - 1800000), // 30 min ago
      message: `Entering ${ticker} ${contract.strike}${contract.type} (${tradeType}) at mid $${contract.mid.toFixed(2)}. TP/SL based on defaults.`,
      price: contract.mid,
    },
  ] : [];
  
  return {
    id: `trade-${Date.now()}`,
    ticker,
    contract,
    tradeType,
    state,
    entryPrice,
    entryTime: state === 'ENTERED' ? new Date(Date.now() - 1800000) : undefined,
    currentPrice,
    targetPrice: entryPrice ? entryPrice * 1.5 : undefined,
    stopLoss: entryPrice ? entryPrice * 0.85 : undefined,
    movePercent,
    updates,
    discordChannels: [],
    challenges: [],
  };
}

export const mockHistoryTrades: Trade[] = [
  {
    id: 'hist-1',
    ticker: 'SPX',
    contract: {
      id: 'c1',
      strike: 4500,
      expiry: 'Nov 10',
      expiryDate: new Date('2025-11-10'),
      daysToExpiry: 0,
      type: 'C',
      mid: 12.5,
      bid: 12.3,
      ask: 12.7,
      volume: 5420,
      openInterest: 12500,
      delta: 0.55,
      iv: 25,
    },
    tradeType: 'Scalp',
    state: 'EXITED',
    entryPrice: 12.5,
    entryTime: new Date('2025-11-10T09:30:00'),
    exitPrice: 18.2,
    exitTime: new Date('2025-11-10T14:15:00'),
    movePercent: 45.6,
    updates: [],
    discordChannels: ['scalps'],
    challenges: ['ch-1'], // November Challenge
  },
  {
    id: 'hist-2',
    ticker: 'QQQ',
    contract: {
      id: 'c2',
      strike: 385,
      expiry: 'Nov 8',
      expiryDate: new Date('2025-11-08'),
      daysToExpiry: 2,
      type: 'P',
      mid: 8.4,
      bid: 8.2,
      ask: 8.6,
      volume: 3200,
      openInterest: 8900,
      delta: -0.45,
      iv: 28,
    },
    tradeType: 'Day',
    state: 'EXITED',
    entryPrice: 8.4,
    entryTime: new Date('2025-11-08T10:00:00'),
    exitPrice: 6.8,
    exitTime: new Date('2025-11-08T15:30:00'),
    movePercent: -19.0,
    updates: [],
    discordChannels: ['day-trades'],
    challenges: [],
  },
];
