import { Contract } from '../../../types';
import { formatPrice, cn } from '../../../lib/utils';

interface HDRowContractProps {
  contract: Contract;
  selected?: boolean;
  onClick?: () => void;
}

export function HDRowContract({ contract, selected, onClick }: HDRowContractProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full grid grid-cols-7 gap-3 px-3 py-2 border-b border-[var(--border-hairline)]',
        'hover:bg-[var(--surface-1)] transition-colors text-left text-xs',
        selected && 'bg-[var(--surface-2)] border-l-2 border-l-[var(--brand-primary)]'
      )}
    >
      <div>
        <span className={cn(
          'font-medium',
          contract.type === 'C' ? 'text-[var(--accent-positive)]' : 'text-[var(--accent-negative)]'
        )}>
          {contract.strike}{contract.type}
        </span>
      </div>
      <div className="text-[var(--text-muted)]">
        {contract.expiry}
      </div>
      <div className="text-[var(--text-high)] tabular-nums">
        ${formatPrice(contract.mid)}
      </div>
      <div className="text-[var(--text-muted)] tabular-nums">
        Δ {contract.delta?.toFixed(2) || '--'}
      </div>
      <div className="text-[var(--text-muted)] tabular-nums">
        IV {contract.iv ? `${contract.iv.toFixed(0)}%` : '--'}
      </div>
      <div className="text-[var(--text-muted)] tabular-nums">
        Vol {contract.volume.toLocaleString()}
      </div>
      <div className="text-[var(--text-muted)] tabular-nums">
        OI {contract.openInterest.toLocaleString()}
      </div>
    </button>
  );
}
