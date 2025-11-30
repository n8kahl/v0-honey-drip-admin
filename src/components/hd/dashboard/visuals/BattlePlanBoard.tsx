/**
 * BattlePlanBoard - Kanban-style battle plan tracker
 *
 * Three columns: On Radar → Charting → Ready
 * Helps traders organize and prep their next session watchlist
 */

import { useState } from "react";
import { cn } from "../../../../lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Trash2,
  TrendingUp,
  TrendingDown,
  Edit3,
  Check,
  X,
} from "lucide-react";
import type { BattlePlanItem, BattlePlanStatus } from "../../../../types/radar-visuals";
import { BATTLE_PLAN_COLUMNS } from "../../../../types/radar-visuals";

export interface BattlePlanBoardProps {
  items: BattlePlanItem[];
  onUpdateItem: (item: BattlePlanItem) => void;
  onRemoveItem?: (id: string) => void;
  className?: string;
}

export function BattlePlanBoard({
  items,
  onUpdateItem,
  onRemoveItem,
  className,
}: BattlePlanBoardProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");

  // Group items by status
  const itemsByStatus = {
    radar: items.filter((i) => i.status === "radar"),
    analyzing: items.filter((i) => i.status === "analyzing"),
    ready: items.filter((i) => i.status === "ready"),
  };

  const handleMoveStatus = (item: BattlePlanItem, newStatus: BattlePlanStatus) => {
    onUpdateItem({ ...item, status: newStatus });
  };

  const handleStartEdit = (item: BattlePlanItem) => {
    setEditingId(item.id);
    setEditNotes(item.notes);
  };

  const handleSaveEdit = (item: BattlePlanItem) => {
    onUpdateItem({ ...item, notes: editNotes });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditNotes("");
  };

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] p-6",
          className
        )}
      >
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎯</div>
          <h4 className="text-lg font-semibold text-[var(--text-high)] mb-2">
            Build Your Battle Plan
          </h4>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Click setups from the Opportunity Matrix or Session Scenarios to add them here. Organize
            your prep work and be ready when the bell rings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--surface-1)] border border-[var(--border-hairline)] overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-hairline)]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-high)]">Battle Plan</h3>
          <span className="text-xs text-[var(--text-muted)]">{items.length} symbols tracked</span>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(BATTLE_PLAN_COLUMNS) as BattlePlanStatus[]).map((status) => {
            const column = BATTLE_PLAN_COLUMNS[status];
            const columnItems = itemsByStatus[status];

            return (
              <div
                key={status}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-2)]/30 overflow-hidden"
              >
                {/* Column Header */}
                <div className="px-3 py-2 border-b border-[var(--border-hairline)] bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between">
                    <h4 className={cn("text-sm font-semibold", column.color)}>{column.title}</h4>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {columnItems.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {column.description}
                  </p>
                </div>

                {/* Column Items */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {columnItems.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-xs text-[var(--text-muted)]">
                      No items
                    </div>
                  ) : (
                    columnItems.map((item) => (
                      <BattlePlanCard
                        key={item.id}
                        item={item}
                        isEditing={editingId === item.id}
                        editNotes={editNotes}
                        onSetEditNotes={setEditNotes}
                        onStartEdit={handleStartEdit}
                        onSaveEdit={handleSaveEdit}
                        onCancelEdit={handleCancelEdit}
                        onMoveLeft={() =>
                          handleMoveStatus(item, status === "analyzing" ? "radar" : "analyzing")
                        }
                        onMoveRight={() =>
                          handleMoveStatus(item, status === "radar" ? "analyzing" : "ready")
                        }
                        onRemove={onRemoveItem ? () => onRemoveItem(item.id) : undefined}
                        canMoveLeft={status !== "radar"}
                        canMoveRight={status !== "ready"}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Tip */}
      <div className="px-4 py-3 border-t border-[var(--border-hairline)] bg-[var(--surface-2)]/30">
        <p className="text-xs text-[var(--text-muted)] text-center">
          💡 Move items to "Ready" once you've charted levels and set alerts
        </p>
      </div>
    </div>
  );
}

// Individual battle plan card
interface BattlePlanCardProps {
  item: BattlePlanItem;
  isEditing: boolean;
  editNotes: string;
  onSetEditNotes: (notes: string) => void;
  onStartEdit: (item: BattlePlanItem) => void;
  onSaveEdit: (item: BattlePlanItem) => void;
  onCancelEdit: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove?: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

function BattlePlanCard({
  item,
  isEditing,
  editNotes,
  onSetEditNotes,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onMoveLeft,
  onMoveRight,
  onRemove,
  canMoveLeft,
  canMoveRight,
}: BattlePlanCardProps) {
  return (
    <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-1)] p-3 hover:border-[var(--brand-primary)]/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {item.direction === "long" && <TrendingUp className="w-3.5 h-3.5 text-green-400" />}
          {item.direction === "short" && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className="font-bold text-[var(--text-high)]">{item.symbol}</span>
        </div>

        {/* Delete Button */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-colors"
            title="Remove from plan"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Entry/Target Info */}
      {(item.entryLevel || item.targetLevel) && (
        <div className="text-[10px] text-[var(--text-muted)] mb-2 space-y-0.5">
          {item.entryLevel && (
            <div>
              Entry: <span className="font-mono text-[var(--text-high)]">{item.entryLevel}</span>
            </div>
          )}
          {item.targetLevel && (
            <div>
              Target: <span className="font-mono text-[var(--text-high)]">{item.targetLevel}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes Section */}
      <div className="mb-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editNotes}
              onChange={(e) => onSetEditNotes(e.target.value)}
              placeholder="Add notes: levels, alerts, plan..."
              className="w-full px-2 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--surface-2)] text-[var(--text-high)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary)] resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={() => onSaveEdit(item)}
                className="flex-1 px-2 py-1 text-xs rounded bg-green-500 text-white hover:bg-green-600 flex items-center justify-center gap-1"
              >
                <Check className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="flex-1 px-2 py-1 text-xs rounded bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {item.notes ? (
              <p className="text-xs text-[var(--text-muted)] mb-1">{item.notes}</p>
            ) : (
              <p className="text-xs text-[var(--text-muted)] italic mb-1">No notes yet</p>
            )}
            <button
              onClick={() => onStartEdit(item)}
              className="flex items-center gap-1 text-[10px] text-[var(--brand-primary)] hover:underline"
            >
              <Edit3 className="w-3 h-3" />
              {item.notes ? "Edit" : "Add"} notes
            </button>
          </div>
        )}
      </div>

      {/* Move Buttons */}
      <div className="flex gap-1">
        <button
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          className={cn(
            "flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors",
            canMoveLeft
              ? "bg-[var(--surface-2)] text-[var(--text-high)] hover:bg-[var(--surface-3)]"
              : "bg-[var(--surface-2)]/50 text-[var(--text-muted)]/50 cursor-not-allowed"
          )}
        >
          <ArrowLeft className="w-3 h-3" />
          Move Left
        </button>
        <button
          onClick={onMoveRight}
          disabled={!canMoveRight}
          className={cn(
            "flex-1 px-2 py-1.5 text-xs rounded flex items-center justify-center gap-1 transition-colors",
            canMoveRight
              ? "bg-[var(--surface-2)] text-[var(--text-high)] hover:bg-[var(--surface-3)]"
              : "bg-[var(--surface-2)]/50 text-[var(--text-muted)]/50 cursor-not-allowed"
          )}
        >
          Move Right
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default BattlePlanBoard;
