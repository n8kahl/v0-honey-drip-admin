
/**
 * Technical Indicator Calculations
 * Shared logic for BacktestEngine and EventDrivenBacktestEngine
 */

export function calculateSMA(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1];
    const slice = values.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

export function calculateEMA(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
        emaArray.push(values[i] * k + emaArray[i - 1] * (1 - k));
    }
    return emaArray;
}

export function calculateRSI(closes: number[], period: number = 14): number | null {
    if (closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Calculate subsequent values using Wilder's Smoothing
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

export function calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
): number {
    if (highs.length < period + 1) return 0;

    const trs: number[] = [];
    // First TR is simply high - low
    trs.push(highs[0] - lows[0]);

    for (let i = 1; i < highs.length; i++) {
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i - 1]);
        const lc = Math.abs(lows[i] - closes[i - 1]);
        trs.push(Math.max(hl, hc, lc));
    }

    // Calculate SMA of TRs for ATR
    // (Note: Wilder's smoothing is standard for ATR, but SMA is often used for simplicity.
    // Using Wilder's here for accuracy)
    let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < trs.length; i++) {
        atr = (atr * (period - 1) + trs[i]) / period;
    }

    return atr;
}

export function calculateStdDev(values: number[], period: number): number {
    if (values.length < period) return 0;
    const slice = values.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const sqDiffs = slice.map((v) => Math.pow(v - mean, 2));
    const avgSqDiff = sqDiffs.reduce((a, b) => a + b, 0) / period;
    return Math.sqrt(avgSqDiff);
}

export function calculateVWAP(bars: any[]): number | null {
    let cumVolume = 0;
    let cumPV = 0;

    for (const bar of bars) {
        const typicalPrice = (bar.high + bar.low + bar.close) / 3;
        cumPV += typicalPrice * bar.volume;
        cumVolume += bar.volume;
    }

    return cumVolume > 0 ? cumPV / cumVolume : null;
}
