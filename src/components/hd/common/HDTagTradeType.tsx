import { TradeType } from '../../../types';
import { HDChip } from './HDChip';
import { cn } from '../../../lib/utils';

interface HDTagTradeTypeProps {
  type: TradeType;
  className?: string;
}

const typeVariantMap: Record<TradeType, 'scalp' | 'day' | 'swing' | 'leap'> = {
  Scalp: 'scalp',
  Day: 'day',
  Swing: 'swing',
  LEAP: 'leap'
};

export function HDTagTradeType({ type, className }: HDTagTradeTypeProps) {
  const variant = typeVariantMap[type];
  
  return (
    <HDChip variant={variant} size="md" className={cn('uppercase tracking-wide', className)}>
      {type}
    </HDChip>
  );
}
