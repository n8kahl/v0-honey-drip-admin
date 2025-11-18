import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { HDButton } from './HDButton';
import type { StrategyDefinition } from '../../types/strategy';

interface HDDialogEditStrategyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: StrategyDefinition | null;
  onSave: (updated: Partial<StrategyDefinition>) => Promise<void>;
  loading?: boolean;
}

export function HDDialogEditStrategy({
  open,
  onOpenChange,
  strategy,
  onSave,
  loading,
}: HDDialogEditStrategyProps) {
  const [name, setName] = useState(strategy?.name || '');
  const [description, setDescription] = useState(strategy?.description || '');
  const [alertBehaviors, setAlertBehaviors] = useState<string[]>(() => {
    if (strategy?.alertBehavior) {
      return Object.entries(strategy.alertBehavior)
        .filter(([k, v]) => v === true)
        .map(([k]) => k);
    }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when strategy changes
  React.useEffect(() => {
    setName(strategy?.name || '');
    setDescription(strategy?.description || '');
    if (strategy?.alertBehavior) {
      setAlertBehaviors(
        Object.entries(strategy.alertBehavior)
          .filter(([k, v]) => v === true)
          .map(([k]) => k)
      );
    } else {
      setAlertBehaviors([]);
    }
  }, [strategy]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    // Convert alertBehaviors array to object
    const alertBehaviorObj: any = {};
    ALL_BEHAVIORS.forEach(({ key }) => {
      alertBehaviorObj[key] = alertBehaviors.includes(key);
    });
    await onSave({
      id: strategy?.id,
      name,
      description,
      alertBehavior: alertBehaviorObj,
    });
    setSaving(false);
    onOpenChange(false);
  };

  // For now, just a simple multi-checkbox for alert behaviors
  const ALL_BEHAVIORS = [
    { key: 'flashWatchlist', label: 'Flash Watchlist' },
    { key: 'showNowPlaying', label: 'Show Now Playing' },
    { key: 'notifyDiscord', label: 'Notify Discord' },
    { key: 'autoOpenTradePlanner', label: 'Auto-Open Trade Planner' },
  ];
  const toggleBehavior = (b: string) => {
    setAlertBehaviors((prev) => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[var(--surface-2)] border border-[var(--border-hairline)] border-t-2 border-t-[var(--brand-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-high)]">Edit Strategy</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[var(--text-high)] text-sm">Name</Label>
            <input
              id="name"
              className="w-full p-2 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] text-[var(--text-high)]"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[var(--text-high)] text-sm">Description</Label>
            <textarea
              id="description"
              className="w-full p-2 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] text-[var(--text-high)]"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--text-high)] text-sm">Alert Behaviors</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_BEHAVIORS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertBehaviors.includes(key)}
                    onChange={() => toggleBehavior(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <DialogFooter>
            <HDButton type="submit" variant="primary" disabled={saving || loading || !name.trim()}>
              {saving || loading ? 'Saving...' : 'Save Changes'}
            </HDButton>
            <HDButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </HDButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
