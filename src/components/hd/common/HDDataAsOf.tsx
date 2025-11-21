import { formatTime } from '../../lib/utils';
import { HDBadgeFreshness } from '../signals/HDBadgeFreshness';

interface HDDataAsOfProps {
  timestamp: Date;
  stale: boolean;
  className?: string;
}

export function HDDataAsOf({ timestamp, stale, className }: HDDataAsOfProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className || ''}`}>
      <span className="text-[var(--text-muted)] text-xs">
        Data as of {formatTime(timestamp)} ET
      </span>
      <HDBadgeFreshness stale={stale} />
    </div>
  );
}
