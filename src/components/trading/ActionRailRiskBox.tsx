/**
 * ActionRailRiskBox - Risk Parameters Editor
 *
 * Displays and allows editing of trade risk parameters:
 * - Entry price
 * - Stop loss
 * - Target prices (T1, T2, T3)
 * - Risk/Reward ratio
 */

import React, { useState } from "react";
import type { Trade } from "../../types";
import { fmtPrice, fmtPct } from "../../ui/semantics";
import { cn } from "../../lib/utils";
import { Edit2, Target, Shield, TrendingUp, Calculator } from "lucide-react";

interface ActionRailRiskBoxProps {
  trade: Trade;
  onPriceChange?: (field: string, value: number) => void;
}

export function ActionRailRiskBox({ trade, onPriceChange }: ActionRailRiskBoxProps) {
  const [editingField, setEditingField] = useState<string | null>(null);

  const entryPrice = trade.entryPrice || trade.contract?.mid || 0;
  const stopLoss = trade.stopLoss || 0;
  const targetPrice = trade.targetPrice || 0;

  // Calculate R:R ratio
  const risk = entryPrice - stopLoss;
  const reward = targetPrice - entryPrice;
  const rrRatio = risk > 0 ? (reward / risk).toFixed(1) : "—";

  // Calculate distances
  const stopDistance = entryPrice > 0 ? ((entryPrice - stopLoss) / entryPrice) * 100 : 0;
  const targetDistance = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0;

  return (
    <div className="border-b border-[var(--border-hairline)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface-2)]">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
          Risk Parameters
        </span>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
          <span>R:R</span>
          <span className="font-medium text-[var(--brand-primary)] tabular-nums">
            1:{rrRatio}
          </span>
        </div>
      </div>

      {/* Risk Grid */}
      <div className="p-3 space-y-2">
        {/* Entry */}
        <RiskRow
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Entry"
          value={entryPrice}
          editing={editingField === "entry"}
          onEdit={() => setEditingField(editingField === "entry" ? null : "entry")}
          onSave={(v) => {
            onPriceChange?.("entry", v);
            setEditingField(null);
          }}
        />

        {/* Stop Loss */}
        <RiskRow
          icon={<Shield className="w-3.5 h-3.5" />}
          label="Stop"
          value={stopLoss}
          distance={-stopDistance}
          kind="fail"
          editing={editingField === "stop"}
          onEdit={() => setEditingField(editingField === "stop" ? null : "stop")}
          onSave={(v) => {
            onPriceChange?.("stop", v);
            setEditingField(null);
          }}
        />

        {/* Target */}
        <RiskRow
          icon={<Target className="w-3.5 h-3.5" />}
          label="Target"
          value={targetPrice}
          distance={targetDistance}
          kind="success"
          editing={editingField === "target"}
          onEdit={() => setEditingField(editingField === "target" ? null : "target")}
          onSave={(v) => {
            onPriceChange?.("target", v);
            setEditingField(null);
          }}
        />

        {/* Additional underlying targets if available (Format C) */}
        {trade.targetUnderlyingPrice2 && (
          <RiskRow
            icon={<Target className="w-3.5 h-3.5 opacity-60" />}
            label="T2 (UL)"
            value={trade.targetUnderlyingPrice2}
            kind="success"
            editing={editingField === "t2"}
            onEdit={() => setEditingField(editingField === "t2" ? null : "t2")}
            onSave={(v) => {
              onPriceChange?.("t2", v);
              setEditingField(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Risk Row Component
// ============================================================================

interface RiskRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  distance?: number;
  kind?: "success" | "fail" | "neutral";
  editing: boolean;
  onEdit: () => void;
  onSave: (value: number) => void;
}

function RiskRow({
  icon,
  label,
  value,
  distance,
  kind = "neutral",
  editing,
  onEdit,
  onSave,
}: RiskRowProps) {
  const [inputValue, setInputValue] = useState(value.toFixed(2));

  const colorClass =
    kind === "success"
      ? "text-[var(--accent-positive)]"
      : kind === "fail"
      ? "text-[var(--accent-negative)]"
      : "text-[var(--text-high)]";

  const handleSave = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed > 0) {
      onSave(parsed);
    } else {
      setInputValue(value.toFixed(2));
      onEdit();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors group">
      <div className={cn("text-[var(--text-faint)]", kind !== "neutral" && colorClass)}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wide">
          {label}
        </div>
        {editing ? (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setInputValue(value.toFixed(2));
                onEdit();
              }
            }}
            autoFocus
            className="w-full bg-transparent text-sm font-medium tabular-nums text-[var(--text-high)] outline-none border-b border-[var(--brand-primary)]"
          />
        ) : (
          <div className={cn("text-sm font-medium tabular-nums", colorClass)}>
            {fmtPrice(value)}
          </div>
        )}
      </div>

      {/* Distance percentage */}
      {distance !== undefined && !editing && (
        <div
          className={cn(
            "text-[10px] tabular-nums px-1.5 py-0.5 rounded",
            kind === "success" && "bg-[var(--accent-positive)]/10 text-[var(--accent-positive)]",
            kind === "fail" && "bg-[var(--accent-negative)]/10 text-[var(--accent-negative)]"
          )}
        >
          {fmtPct(distance)}
        </div>
      )}

      {/* Edit button */}
      <button
        onClick={onEdit}
        className={cn(
          "p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-all",
          "opacity-0 group-hover:opacity-100",
          editing && "opacity-100 text-[var(--brand-primary)]"
        )}
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}

export default ActionRailRiskBox;
