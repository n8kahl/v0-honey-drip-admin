import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppSheetSnapPoint = 'half' | 'full' | 'collapsed';

interface AppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  snapPoint?: AppSheetSnapPoint;
  onSnapPointChange?: (snapPoint: AppSheetSnapPoint) => void;
  showHandle?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

export function AppSheet({
  open,
  onOpenChange,
  title,
  children,
  snapPoint = 'half',
  onSnapPointChange,
  showHandle = true,
  closeOnBackdropClick = true,
  className,
}: AppSheetProps) {
  const [currentSnapPoint, setCurrentSnapPoint] = useState<AppSheetSnapPoint>(snapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragCurrentY, setDragCurrentY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Sync snapPoint prop with internal state
  useEffect(() => {
    setCurrentSnapPoint(snapPoint);
  }, [snapPoint]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  // Calculate sheet height based on snap point
  const getSheetHeight = (): string => {
    if (isDragging) {
      const delta = dragCurrentY - dragStartY;
      const baseHeight = currentSnapPoint === 'full' ? 100 : 50;
      const newHeight = Math.max(10, Math.min(100, baseHeight - (delta / window.innerHeight) * 100));
      return `${newHeight}vh`;
    }
    
    switch (currentSnapPoint) {
      case 'full':
        return '100vh';
      case 'half':
        return '50vh';
      case 'collapsed':
        return '0vh';
      default:
        return '50vh';
    }
  };

  // Handle drag start
  const handleDragStart = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStartY(e.clientY);
    setDragCurrentY(e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Handle drag move
  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setDragCurrentY(e.clientY);
  };

  // Handle drag end
  const handleDragEnd = (e: React.PointerEvent) => {
    if (!isDragging) return;
    
    const delta = dragCurrentY - dragStartY;
    const threshold = 100; // pixels
    
    let newSnapPoint: AppSheetSnapPoint = currentSnapPoint;
    
    if (delta > threshold) {
      // Dragged down
      if (currentSnapPoint === 'full') {
        newSnapPoint = 'half';
      } else if (currentSnapPoint === 'half') {
        onOpenChange(false);
        return;
      }
    } else if (delta < -threshold) {
      // Dragged up
      if (currentSnapPoint === 'half') {
        newSnapPoint = 'full';
      }
    }
    
    setCurrentSnapPoint(newSnapPoint);
    onSnapPointChange?.(newSnapPoint);
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-[var(--surface-1)] border-t border-[var(--border-hairline)]',
          'rounded-t-[var(--radius-xl)] shadow-2xl',
          'transition-all duration-300 ease-out',
          'flex flex-col',
          isDragging ? 'transition-none' : '',
          className
        )}
        style={{
          height: getSheetHeight(),
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Handle */}
        {showHandle && (
          <div
            className="w-full pt-3 pb-2 cursor-grab active:cursor-grabbing flex justify-center"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="w-12 h-1 rounded-full bg-[var(--text-faint)] opacity-30" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)]">
            <h2 className="text-[var(--text-high)] font-medium text-lg">{title}</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--surface-2)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </>
  );
}

// Export convenience hook for managing sheet state
export function useAppSheet(defaultOpen = false) {
  const [open, setOpen] = useState(defaultOpen);
  const [snapPoint, setSnapPoint] = useState<AppSheetSnapPoint>('half');

  return {
    open,
    setOpen,
    snapPoint,
    setSnapPoint,
    sheetProps: {
      open,
      onOpenChange: setOpen,
      snapPoint,
      onSnapPointChange: setSnapPoint,
    },
  };
}
