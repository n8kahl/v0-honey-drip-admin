import { useState, useEffect } from "react";
import { Challenge } from "../../../types";
import { AppSheet } from "../../ui/AppSheet";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { HDButton } from "../common/HDButton";

interface HDDialogEditChallengeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
  onUpdateChallenge: (challengeId: string, updates: Partial<Challenge>) => void;
}

export function HDDialogEditChallenge({
  open,
  onOpenChange,
  challenge,
  onUpdateChallenge,
}: HDDialogEditChallengeProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetBalance, setTargetBalance] = useState("");
  const [endDate, setEndDate] = useState("");

  // Populate form when challenge changes
  useEffect(() => {
    if (challenge) {
      setName(challenge.name);
      setDescription(challenge.description || "");
      setTargetBalance(challenge.targetBalance.toString());
      setEndDate(challenge.endDate);
    }
  }, [challenge]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!challenge || !name.trim() || !endDate) return;

    const updates: Partial<Challenge> = {
      name: name.trim(),
      description: description.trim() || undefined,
      targetBalance: parseFloat(targetBalance) || challenge.targetBalance,
      endDate,
    };

    onUpdateChallenge(challenge.id, updates);
    onOpenChange(false);
  };

  if (!challenge) return null;

  return (
    <AppSheet open={open} onOpenChange={onOpenChange} title="Edit Challenge" snapPoint="full">
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

        {/* Immutable Fields - Display Only */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--text-muted)] text-sm flex items-center gap-2">
              Starting Balance
              <span className="text-[10px] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                Read-only
              </span>
            </Label>
            <Input
              type="text"
              value={`$${challenge.startingBalance.toFixed(2)}`}
              disabled
              className="bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[var(--text-muted)] text-sm flex items-center gap-2">
              Current Balance
              <span className="text-[10px] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                Auto-calculated
              </span>
            </Label>
            <Input
              type="text"
              value={`$${challenge.currentBalance.toFixed(2)}`}
              disabled
              className="bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
            />
          </div>
        </div>

        {/* Editable Fields */}
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[var(--text-muted)] text-sm flex items-center gap-2">
              Start Date
              <span className="text-[10px] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                Read-only
              </span>
            </Label>
            <Input
              type="date"
              value={challenge.startDate}
              disabled
              className="bg-[var(--surface-3)] border-[var(--border-hairline)] text-[var(--text-muted)] cursor-not-allowed"
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

        <div className="flex gap-2 justify-end pt-4">
          <HDButton type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </HDButton>
          <HDButton type="submit" variant="primary" disabled={!name.trim() || !endDate}>
            Save Changes
          </HDButton>
        </div>
      </form>
    </AppSheet>
  );
}
