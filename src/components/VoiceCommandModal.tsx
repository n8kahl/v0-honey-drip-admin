import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceCommandModal({ isOpen, onClose }: VoiceCommandModalProps) {
  const [listening, setListening] = useState(true);
  
  useEffect(() => {
    if (isOpen) {
      setListening(true);
      // Simulate voice detection
      const timeout = setTimeout(() => {
        setListening(false);
        setTimeout(onClose, 1000);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-1)] border border-[var(--border-hairline)] rounded-[var(--radius)] p-8 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-high)]"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="text-center">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--brand-primary)]/10 flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full bg-[var(--brand-primary)]/20 flex items-center justify-center ${listening ? 'animate-pulse' : ''}`}>
                <div className="w-12 h-12 rounded-full bg-[var(--brand-primary)]" />
              </div>
            </div>
          </div>
          
          <h3 className="text-[var(--text-high)] mb-2">
            {listening ? 'Listening...' : 'Processing...'}
          </h3>
          <p className="text-[var(--text-muted)] text-sm">
            {listening ? 'Speak your command' : 'Command received'}
          </p>
          
          {!listening && (
            <div className="mt-6 p-3 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border-hairline)]">
              <p className="text-[var(--text-high)] text-sm">
                "Light trim on SPX"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
