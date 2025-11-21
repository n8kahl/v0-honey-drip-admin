import React, { useState } from 'react';
import { AppSheet } from '../ui/AppSheet';
import { Label } from '../ui/label';
import { HDButton } from '../common/HDButton';
import type { StrategyDefinition, StrategyCategory, EntrySide } from '../../types/strategy';

interface HDDialogCreateStrategyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (newStrategy: Partial<StrategyDefinition>) => Promise<void>;
  loading?: boolean;
}

export function HDDialogCreateStrategy({
  open,
  onOpenChange,
  onCreate,
  loading,
}: HDDialogCreateStrategyProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StrategyCategory>('OTHER');
  const [entrySide, setEntrySide] = useState<EntrySide>('LONG');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setError(null);
    setSaving(true);
    await onCreate({
      name,
      description,
      category,
      entrySide,
      isCoreLibrary: false,
      enabled: true,
      alertBehavior: {
        flashWatchlist: false,
        showNowPlaying: false,
        notifyDiscord: false,
        autoOpenTradePlanner: false,
      },
    });
    setSaving(false);
    setName('');
    setDescription('');
    setCategory('OTHER');
    setEntrySide('LONG');
    onOpenChange(false);
  };

  return (
    <AppSheet 
      open={open} 
      onOpenChange={onOpenChange}
      title="Create New Strategy"
      snapPoint="full"
    >
      <form onSubmit={handleCreate} className="space-y-4 p-4">
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
            <Label className="text-[var(--text-high)] text-sm">Category</Label>
            <select
              className="w-full p-2 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] text-[var(--text-high)]"
              value={category}
              onChange={e => setCategory(e.target.value as StrategyCategory)}
            >
              <option value="OPTIONS_DAY_TRADE">Options Day Trade</option>
              <option value="SWING">Swing</option>
              <option value="INTRADAY">Intraday</option>
              <option value="SPX_SPECIAL">SPX Special</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--text-high)] text-sm">Entry Side</Label>
            <select
              className="w-full p-2 rounded border border-[var(--border-hairline)] bg-[var(--surface-1)] text-[var(--text-high)]"
              value={entrySide}
              onChange={e => setEntrySide(e.target.value as EntrySide)}
            >
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex gap-2 justify-end">
            <HDButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </HDButton>
            <HDButton type="submit" variant="primary" disabled={saving || loading || !name.trim()}>
              {saving || loading ? 'Creating...' : 'Create Strategy'}
            </HDButton>
          </div>
        </form>
    </AppSheet>
  );
}
