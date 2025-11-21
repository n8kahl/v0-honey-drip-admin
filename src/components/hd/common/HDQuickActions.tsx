import { TradeState } from '../../../types';
import { HDButton } from './HDButton';

interface HDQuickActionsProps {
  state: TradeState;
  onLoadIdea?: () => void;
  onEnter?: () => void;
  onDiscard?: () => void;
  onTrim?: () => void;
  onUpdate?: () => void;
  onUpdateSL?: () => void;
  onTrailStop?: () => void;
  onAdd?: () => void;
  onExit?: () => void;
}

export function HDQuickActions({
  state,
  onLoadIdea,
  onEnter,
  onDiscard,
  onTrim,
  onUpdate,
  onUpdateSL,
  onTrailStop,
  onAdd,
  onExit
}: HDQuickActionsProps) {
  if (state === 'WATCHING') {
    return (
      <div className="space-y-3">
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-2">
          Quick Actions
        </h3>
        <HDButton variant="primary" className="w-full" onClick={onLoadIdea}>
          Load Trade Idea
        </HDButton>
      </div>
    );
  }
  
  if (state === 'LOADED') {
    return (
      <div className="space-y-3">
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-2">
          Quick Actions
        </h3>
        <HDButton variant="primary" className="w-full" onClick={onEnter}>
          Enter Now
        </HDButton>
        <HDButton variant="ghost" className="w-full" onClick={onDiscard}>
          Discard
        </HDButton>
      </div>
    );
  }
  
  if (state === 'ENTERED') {
    return (
      <div className="space-y-2">
        <h3 className="text-[var(--text-muted)] text-micro uppercase tracking-wide mb-3">
          Quick Actions
        </h3>
        <HDButton variant="secondary" className="w-full justify-start" onClick={onTrim}>
          <span className="flex-1 text-left">Trim</span>
          <span className="text-[var(--text-muted)] text-micro">Lock P&L</span>
        </HDButton>
        <HDButton variant="secondary" className="w-full justify-start" onClick={onUpdate}>
          <span className="flex-1 text-left">Update</span>
        </HDButton>
        <HDButton variant="secondary" className="w-full justify-start" onClick={onUpdateSL}>
          <span className="flex-1 text-left">Update Stop Loss</span>
        </HDButton>
        <HDButton variant="secondary" className="w-full justify-start" onClick={onTrailStop}>
          <span className="flex-1 text-left">Trail Stop</span>
        </HDButton>
        <HDButton variant="secondary" className="w-full justify-start" onClick={onAdd}>
          <span className="flex-1 text-left">Add to Position</span>
        </HDButton>
        <div className="pt-2 border-t border-[var(--border-hairline)]">
          <HDButton variant="primary" className="w-full" onClick={onExit}>
            Full Exit
          </HDButton>
        </div>
      </div>
    );
  }
  
  return null;
}
