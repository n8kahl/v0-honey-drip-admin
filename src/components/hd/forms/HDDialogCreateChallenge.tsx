import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';
import { Button } from '../../ui/button';
import { ChallengeScope, DiscordChannel } from '../../types';

interface HDDialogCreateChallengeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChallenge: (name: string, scope: ChallengeScope, defaultChannel?: string) => void;
  availableChannels: DiscordChannel[];
}

export function HDDialogCreateChallenge({
  open,
  onOpenChange,
  onCreateChallenge,
  availableChannels
}: HDDialogCreateChallengeProps) {
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ChallengeScope>('admin');
  const [defaultChannel, setDefaultChannel] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreateChallenge(name.trim(), scope, defaultChannel || undefined);
      setName('');
      setScope('admin');
      setDefaultChannel('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-1)] border-[var(--border-hairline)] border-t-2 border-t-[var(--brand-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-high)]">Create Challenge</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="challenge-name" className="text-[var(--text-med)]">
              Challenge Name
            </Label>
            <Input
              id="challenge-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="November Scalps Challenge"
              className="bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)]"
              autoFocus
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="challenge-scope" className="text-[var(--text-med)]">
              Scope
            </Label>
            <Select value={scope} onValueChange={(v) => setScope(v as ChallengeScope)}>
              <SelectTrigger className="bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface-1)] border-[var(--border-hairline)]">
                <SelectItem value="admin-specific" className="text-[var(--text-high)]">
                  Admin Specific
                </SelectItem>
                <SelectItem value="honeydrip-wide" className="text-[var(--text-high)]">
                  Honey Drip Wide
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="default-channel" className="text-[var(--text-med)]">
              Default Discord Channel (Optional)
            </Label>
            <Select value={defaultChannel} onValueChange={setDefaultChannel}>
              <SelectTrigger className="bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-high)]">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--surface-1)] border-[var(--border-hairline)]">
                <SelectItem value="" className="text-[var(--text-high)]">
                  None
                </SelectItem>
                {availableChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id} className="text-[var(--text-high)]">
                    #{channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-[var(--surface-2)] border-[var(--border-hairline)] text-[var(--text-med)] hover:bg-[var(--surface-1)] hover:text-[var(--text-high)]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary)]/90"
            >
              Create Challenge
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
