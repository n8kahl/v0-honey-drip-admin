import { useState } from 'react';
import { HDVoiceHUD, VoiceCommand } from './hd/voice/HDVoiceHUD';
import { HDVoiceDrawer } from './hd/voice/HDVoiceDrawer';
import { HDHeader } from './hd/layout/HDHeader';

/**
 * Voice Command Demo Component
 * 
 * Demonstrates the voice command UI patterns for Honey Drip Admin:
 * - Desktop: Compact Voice HUD positioned at top center
 * - Mobile: Bottom drawer that slides up
 * - All voice commands lead to existing flows (never bypass the composer)
 * 
 * Example voice commands supported:
 * - "Add TSLA to the watchlist"
 * - "Remove QQQ from the watchlist"
 * - "Load SPX 0DTE 5800 call"
 * - "Enter the loaded SPX trade"
 * - "Trim the current SPX trade"
 * - "Update stop loss to breakeven"
 * - "Exit the current trade"
 */
export function VoiceCommandDemo() {
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [hudState, setHudState] = useState<'listening' | 'processing' | 'confirming' | 'error' | 'ambiguous' | null>(null);
  const [transcript, setTranscript] = useState('');
  const [command, setCommand] = useState<VoiceCommand | null>(null);

  const handleMicClick = () => {
    if (voiceState === 'idle') {
      // Start listening
      setVoiceState('listening');
      setHudState('listening');
      setTranscript('');
      
      // Simulate transcription
      setTimeout(() => {
        setTranscript('Add TSLA to the watchlist');
      }, 1000);
      
      // Simulate processing
      setTimeout(() => {
        setVoiceState('processing');
        setHudState('processing');
      }, 2000);
      
      // Show confirmation
      setTimeout(() => {
        setVoiceState('listening');
        setHudState('confirming');
        setCommand({
          transcript: 'Add TSLA to the watchlist',
          action: 'Add TSLA to watchlist',
          details: 'Will add TSLA to your watchlist',
        });
      }, 2500);
    } else {
      // Cancel
      setVoiceState('idle');
      setHudState(null);
      setTranscript('');
      setCommand(null);
    }
  };

  const handleConfirm = () => {
    console.log('Voice command confirmed:', command);
    setVoiceState('idle');
    setHudState(null);
    setTranscript('');
    setCommand(null);
  };

  const handleCancel = () => {
    setVoiceState('idle');
    setHudState(null);
    setTranscript('');
    setCommand(null);
  };

  const handleRetry = () => {
    setVoiceState('listening');
    setHudState('listening');
    setTranscript('');
  };

  // Example scenarios
  const runScenario = (scenario: 'add-ticker' | 'trim-trade' | 'exit-trade' | 'error' | 'ambiguous') => {
    setVoiceState('listening');
    setHudState('listening');
    setTranscript('');
    
    const scenarios = {
      'add-ticker': {
        transcript: 'Add TSLA to the watchlist',
        command: {
          transcript: 'Add TSLA to the watchlist',
          action: 'Add TSLA to watchlist',
          details: 'Will add TSLA to your watchlist',
        },
      },
      'trim-trade': {
        transcript: 'Trim SPX scalp',
        command: {
          transcript: 'Trim SPX scalp',
          action: 'Trim current position',
          details: 'SPX 5800C (Scalp)',
        },
      },
      'exit-trade': {
        transcript: 'Exit the current trade',
        command: {
          transcript: 'Exit the current trade',
          action: 'Exit current trade',
          details: 'SPX 5800C (Scalp)',
        },
      },
      'error': {
        transcript: 'Mumble mumble something unclear',
        command: null,
      },
      'ambiguous': {
        transcript: 'Load the SPX trade',
        command: {
          transcript: 'Load the SPX trade',
          action: 'Multiple matches found',
          details: 'Which SPX trade?',
          options: [
            { id: '1', label: 'SPX 5800C 0DTE' },
            { id: '2', label: 'SPX 5900C 1DTE' },
            { id: '3', label: 'SPX 5850P 0DTE' },
          ],
        },
      },
    };

    const selected = scenarios[scenario];
    
    // Show transcript
    setTimeout(() => {
      setTranscript(selected.transcript);
    }, 500);
    
    // Process
    setTimeout(() => {
      setVoiceState('processing');
      setHudState('processing');
    }, 1500);
    
    // Show result
    setTimeout(() => {
      setVoiceState('listening');
      if (scenario === 'error') {
        setHudState('error');
      } else if (scenario === 'ambiguous') {
        setHudState('ambiguous');
        setCommand(selected.command);
      } else {
        setHudState('confirming');
        setCommand(selected.command!);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-[var(--text-high)] flex flex-col">
      <HDHeader
        sessionStatus="open"
        dataTimestamp={new Date()}
        dataStale={false}
        voiceState={voiceState}
        onMicClick={handleMicClick}
      />
      
      <div className="flex-1 p-6 lg:p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Voice Commands Demo</h1>
            <p className="text-[var(--text-muted)]">
              Click the Voice button in the header or press 'M' to activate voice commands.
              This demo shows how voice integrates with existing trading flows.
            </p>
          </div>

          <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-6 space-y-4">
            <h2 className="font-semibold">Try Example Scenarios</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                onClick={() => runScenario('add-ticker')}
                className="h-10 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] transition-colors font-medium text-sm"
              >
                Add Ticker
              </button>
              <button
                onClick={() => runScenario('trim-trade')}
                className="h-10 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] transition-colors font-medium text-sm"
              >
                Trim Trade
              </button>
              <button
                onClick={() => runScenario('exit-trade')}
                className="h-10 rounded-[var(--radius)] bg-[var(--brand-primary)] text-[var(--bg-base)] hover:bg-[var(--brand-primary-hover)] transition-colors font-medium text-sm"
              >
                Exit Trade
              </button>
              <button
                onClick={() => runScenario('error')}
                className="h-10 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium text-sm border border-[var(--border-hairline)]"
              >
                Error State
              </button>
              <button
                onClick={() => runScenario('ambiguous')}
                className="h-10 rounded-[var(--radius)] bg-[var(--surface-1)] text-[var(--text-high)] hover:bg-[var(--surface-3)] transition-colors font-medium text-sm border border-[var(--border-hairline)]"
              >
                Ambiguous
              </button>
            </div>
          </div>

          <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-6 space-y-3">
            <h2 className="font-semibold">Supported Commands</h2>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li>• <span className="text-[var(--text-high)]">"Add TSLA to the watchlist"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Remove QQQ from the watchlist"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Load SPX 0DTE 5800 call"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Enter the loaded SPX trade"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Trim the current SPX trade"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Update stop loss to breakeven"</span></li>
              <li>• <span className="text-[var(--text-high)]">"Exit the current trade"</span></li>
            </ul>
          </div>

          <div className="bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)] p-6 space-y-3">
            <h2 className="font-semibold">Design Principles</h2>
            <ul className="space-y-2 text-sm text-[var(--text-muted)]">
              <li>• <strong className="text-[var(--text-high)]">Never bypass the composer</strong> - Voice jumps you to the right action, but you still review and send</li>
              <li>• <strong className="text-[var(--text-high)]">Fast & non-blocking</strong> - Lightweight HUD/drawer that doesn't disrupt your workflow</li>
              <li>• <strong className="text-[var(--text-high)]">Keyboard shortcut</strong> - Press 'M' to instantly activate voice from anywhere</li>
              <li>• <strong className="text-[var(--text-high)]">Clear states</strong> - Idle, Listening, Processing, Confirming, Error states</li>
              <li>• <strong className="text-[var(--text-high)]">Pro trading aesthetic</strong> - Fits the terminal look, not a chatbot</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Desktop Voice HUD */}
      {hudState && (
        <div className="hidden lg:block">
          <HDVoiceHUD
            state={hudState}
            transcript={transcript}
            command={command || undefined}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        </div>
      )}

      {/* Mobile Voice Drawer */}
      {hudState && (
        <div className="lg:hidden">
          <HDVoiceDrawer
            state={hudState}
            transcript={transcript}
            command={command || undefined}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onRetry={handleRetry}
          />
        </div>
      )}
    </div>
  );
}
