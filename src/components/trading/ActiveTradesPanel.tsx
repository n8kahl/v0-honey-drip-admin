import React from 'react';
import { Trade, TradeState, AlertType, DiscordChannel, Challenge } from '../../types';
import { HDAlertComposer } from '../hd/alerts/HDAlertComposer';
import { HDQuickActions } from '../hd/common/HDQuickActions';

interface ActiveTradesPanelProps {
  tradeState: TradeState;
  currentTrade: Trade | null;
  showAlert: boolean;
  alertType: AlertType;
  alertOptions: { updateKind?: 'trim' | 'generic' | 'sl' };
  channels: DiscordChannel[];
  challenges: Challenge[];
  onSendAlert: (channelIds: string[], challengeIds: string[], comment?: string) => void;
  onEnterAndAlert: (channelIds: string[], challengeIds: string[], comment?: string, entryPrice?: number) => void;
  onCancelAlert: () => void;
  onUnload: () => void;
  onEnter: () => void;
  onTrim: () => void;
  onUpdate: () => void;
  onUpdateSL: () => void;
  onTrailStop: () => void;
  onAdd: () => void;
  onExit: () => void;
  underlyingPrice?: number;
  underlyingChange?: number;
}

export const ActiveTradesPanel: React.FC<ActiveTradesPanelProps> = ({
  tradeState,
  currentTrade,
  showAlert,
  alertType,
  alertOptions,
  channels,
  challenges,
  onSendAlert,
  onEnterAndAlert,
  onCancelAlert,
  onUnload,
  onEnter,
  onTrim,
  onUpdate,
  onUpdateSL,
  onTrailStop,
  onAdd,
  onExit,
  underlyingPrice,
  underlyingChange,
}) => {
  return (
    <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[var(--border-hairline)] flex flex-col h-full">
      {showAlert && currentTrade ? (
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          <HDAlertComposer
            trade={currentTrade}
            alertType={alertType}
            alertOptions={alertOptions}
            availableChannels={channels}
            challenges={challenges}
            onSend={onSendAlert}
            onEnterAndAlert={onEnterAndAlert}
            onCancel={onCancelAlert}
            onUnload={onUnload}
            underlyingPrice={underlyingPrice}
            underlyingChange={underlyingChange}
          />
        </div>
      ) : tradeState === 'LOADED' && currentTrade ? (
        <div className="flex flex-col h-auto lg:h-full bg-[var(--surface-2)] p-6">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center space-y-3 max-w-[200px]">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius)] bg-[var(--brand-primary)]/10">
                <span className="text-2xl">📋</span>
              </div>
              <p className="text-[var(--text-high)] font-medium">Idea Loaded</p>
              <p className="text-[var(--text-muted)] text-xs leading-relaxed">Use the <span className="text-[var(--brand-primary)] font-medium">Enter Trade</span> button below to proceed when ready.</p>
            </div>
          </div>
        </div>
      ) : tradeState === 'ENTERED' && currentTrade ? (
        <div className="h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6">
          <HDQuickActions
            state={tradeState}
            onTrim={onTrim}
            onUpdate={onUpdate}
            onUpdateSL={onUpdateSL}
            onTrailStop={onTrailStop}
            onAdd={onAdd}
            onExit={onExit}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-auto lg:h-full bg-[var(--surface-2)] p-4 lg:p-6 min-h-[200px]">
          <p className="text-[var(--text-muted)] text-sm text-center">Select a contract to load a trade</p>
        </div>
      )}
    </div>
  );
};
