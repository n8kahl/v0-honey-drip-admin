import { useState } from 'react';
import { Challenge } from '../../types';
import { AppSheet } from '../../ui/AppSheet';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { HDButton } from '../common/HDButton';

interface HDDialogAddChallengeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddChallenge: (challenge: Challenge) => void;
}

export function HDDialogAddChallenge({
  open,
  onOpenChange,
  onAddChallenge,
}: HDDialogAddChallengeProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startingBalance, setStartingBalance] = useState('1000');
  const [targetBalance, setTargetBalance] = useState('10000');
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  const [endDate, setEndDate] = useState(() => {
    const future = new Date();
    future.setMonth(future.getMonth() + 3); // Default to 3 months from now
    return future.toISOString().split('T')[0];
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !startDate || !endDate) return;

    const newChallenge: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      starting_balance: parseFloat(startingBalance) || 1000,
      target_balance: parseFloat(targetBalance) || 10000,
      start_date: startDate,
      end_date: endDate,
    };

    onAddChallenge(newChallenge);
    
    setName('');
    setDescription('');
    setStartingBalance('1000');
    setTargetBalance('10000');
    const today = new Date();
    setStartDate(today.toISOString().split('T')[0]);
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    setEndDate(future.toISOString().split('T')[0]);
    
    onOpenChange(false);
  };

  return (
    <AppSheet 
      open={open} 
      onOpenChange={onOpenChange}
      title="Create New Challenge"
      snapPoint="full"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[var(--text-high)] text-sm">
              Challenge Name
            </Label>
            <Input
              id="name"
              placeholder="e.g., 5K to 50K"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description" className="text-[var(--text-high)] text-sm">
              Description (optional)
            </Label>
            <Input
              id="description"
              placeholder="Challenge description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startingBalance" className="text-[var(--text-high)] text-sm">
                Starting Balance
              </Label>
              <Input
                id="startingBalance"
                type="number"
                step="0.01"
                placeholder="1000"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetBalance" className="text-[var(--text-high)] text-sm">
                Target Balance
              </Label>
              <Input
                id="targetBalance"
                type="number"
                step="0.01"
                placeholder="10000"
                value={targetBalance}
                onChange={(e) => setTargetBalance(e.target.value)}
                className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-[var(--text-high)] text-sm">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-[var(--text-high)] text-sm">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <HDButton
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </HDButton>
            <HDButton
              type="submit"
              variant="primary"
              disabled={!name.trim() || !startDate || !endDate}
            >
              Create Challenge
            </HDButton>
          </div>
      </form>
    </AppSheet>
  );
}
