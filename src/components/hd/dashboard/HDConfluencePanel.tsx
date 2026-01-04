import { SignalEqualizer, type SignalPillar } from "../viz/SignalEqualizer";
import { HDChip } from "../common/HDChip";
import { cn } from "../../../lib/utils";
import { useMarketDataStore } from "../../../stores/marketDataStore";

interface HDConfluencePanelProps {
  ticker: string;
  tradeState: "LOADED" | "ENTERED" | "EXITED";
  direction: "call" | "put";
}

export function HDConfluencePanel({ ticker, tradeState, direction }: HDConfluencePanelProps) {
  // Get confluence data from marketDataStore
  const confluence = useMarketDataStore((state) => state.symbols[ticker]?.confluence);
  const isStale = useMarketDataStore((state) => {
    const lastUpdated = state.symbols[ticker]?.lastUpdated;
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated > 10000; // 10s stale threshold
  });

  const loading = !confluence;
  const error = isStale ? "Data stale" : undefined;

  // Map marketDataStore's ConfluenceScore to UI display values

  // Map confluence score to SignalEqualizer pillars
  const pillars: SignalPillar[] = [
    {
      id: "trend",
      label: "Trend Structure",
      score: confluence?.trend ?? 0,
      detail: getTrendLabel(confluence?.trend ?? 0),
      status:
        (confluence?.trend ?? 0) > 70 ? "good" : (confluence?.trend ?? 0) < 40 ? "bad" : "neutral",
    },
    {
      id: "momentum",
      label: "Momentum",
      score: confluence?.momentum ?? 0,
      detail: getVolLabel(confluence?.momentum ?? 0),
      status: (confluence?.momentum ?? 0) > 60 ? "good" : "neutral",
    },
    {
      id: "volume",
      label: "Volume / Flow",
      score: confluence?.volume ?? 0,
      detail: `${(confluence?.volume ?? 0).toFixed(0)}% Intensity`,
      status: (confluence?.volume ?? 0) > 80 ? "good" : "neutral",
    },
    {
      id: "volatility",
      label: "Volatility",
      score: confluence?.volatility ?? 0,
      detail: getVolLabel(confluence?.volatility ?? 0),
      status: (confluence?.volatility ?? 0) > 70 ? "warning" : "good",
    },
    {
      id: "structure",
      label: "Key Levels",
      score: confluence?.technical ?? 0,
      detail: (confluence?.technical ?? 0) > 50 ? "Near Support" : "In Space",
      status: (confluence?.technical ?? 0) > 70 ? "good" : "neutral",
    },
  ];

  const getStatusBadge = () => {
    if (tradeState === "LOADED") {
      return (
        <HDChip variant="neutral" size="sm" className="uppercase tracking-wide">
          Idea
        </HDChip>
      );
    }
    if (tradeState === "ENTERED") {
      return (
        <HDChip
          variant="custom"
          size="sm"
          color="var(--bg-base)"
          bg="var(--brand-primary)"
          className="uppercase tracking-wide"
        >
          Active
        </HDChip>
      );
    }
    return (
      <HDChip variant="neutral" size="sm" className="uppercase tracking-wide">
        Closed
      </HDChip>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">{getStatusBadge()}</div>

      <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-1">
        <SignalEqualizer
          pillars={pillars}
          overallScore={confluence?.overall ?? 0}
          className="border-none bg-transparent"
        />

        {/* Footer */}
        <div className="px-4 pb-2 text-[var(--text-muted)] text-[10px] text-center border-t border-[var(--border-hairline)] pt-2 mt-1">
          {error ? (
            <span className="text-[var(--accent-negative)]">Data Stale ({error})</span>
          ) : (
            <span>Powered by Massive Advanced Market Flow</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers
function getTrendLabel(score: number): string {
  if (score >= 80) return "Strong Alignment";
  if (score >= 60) return "Bullish Bias";
  if (score >= 40) return "Mixed / Choppy";
  return "Bearish Bias";
}

function getVolLabel(score: number): string {
  if (score >= 80) return "High / Expanded";
  if (score >= 40) return "Moderate";
  return "Low / Squeeze";
}
