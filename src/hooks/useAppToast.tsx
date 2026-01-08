import { useMemo } from "react";
import { toast as sonnerToast, type Toast } from "sonner";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface AppToastOptions {
  /**
   * Toast duration in milliseconds
   * @default 4000
   */
  duration?: number;

  /**
   * Whether to show action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };

  /**
   * Whether to show close button
   * @default true
   */
  closeButton?: boolean;

  /**
   * Description text (shows below title)
   */
  description?: string;
}

/**
 * useAppToast - Hook for displaying toast notifications
 *
 * Provides app-specific toast methods with consistent styling,
 * icons, and behavior.
 *
 * Usage:
 *   const toast = useAppToast();
 *   toast.success('Trade closed successfully');
 *   toast.error('Failed to close trade', { description: 'Try again later' });
 *   toast.info('Price alert triggered for AAPL');
 *   toast.warning('Low account balance detected');
 */
export function useAppToast() {
  // Memoize the entire toast object to prevent infinite loops
  // when used as a dependency in useCallback/useEffect
  return useMemo(() => {
    const getIconColor = (type: ToastType): string => {
      switch (type) {
        case "success":
          return "#10b981"; // green
        case "error":
          return "#ef4444"; // red
        case "warning":
          return "#f59e0b"; // amber
        case "info":
        default:
          return "#3b82f6"; // blue
      }
    };

    return {
      /**
       * Show success toast
       */
      success: (message: string, options?: AppToastOptions): string | number => {
        return sonnerToast.success(message, {
          duration: options?.duration ?? 4000,
          description: options?.description,
          closeButton: options?.closeButton !== false,
          action: options?.action,
          className:
            "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]",
          descriptionClassName: "text-[var(--text-muted)]",
          icon: <CheckCircle2 className="w-5 h-5" style={{ color: getIconColor("success") }} />,
        });
      },

      /**
       * Show error toast
       */
      error: (message: string, options?: AppToastOptions): string | number => {
        return sonnerToast.error(message, {
          duration: options?.duration ?? 4000,
          description: options?.description,
          closeButton: options?.closeButton !== false,
          action: options?.action,
          className:
            "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]",
          descriptionClassName: "text-[var(--text-muted)]",
          icon: <AlertCircle className="w-5 h-5" style={{ color: getIconColor("error") }} />,
        });
      },

      /**
       * Show warning toast
       */
      warning: (message: string, options?: AppToastOptions): string | number => {
        return sonnerToast.warning(message, {
          duration: options?.duration ?? 4000,
          description: options?.description,
          closeButton: options?.closeButton !== false,
          action: options?.action,
          className:
            "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]",
          descriptionClassName: "text-[var(--text-muted)]",
          icon: <AlertTriangle className="w-5 h-5" style={{ color: getIconColor("warning") }} />,
        });
      },

      /**
       * Show info toast
       */
      info: (message: string, options?: AppToastOptions): string | number => {
        return sonnerToast.info(message, {
          duration: options?.duration ?? 4000,
          description: options?.description,
          closeButton: options?.closeButton !== false,
          action: options?.action,
          className:
            "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]",
          descriptionClassName: "text-[var(--text-muted)]",
          icon: <Info className="w-5 h-5" style={{ color: getIconColor("info") }} />,
        });
      },

      /**
       * Show loading toast (doesn't auto-dismiss)
       */
      loading: (message: string): string | number => {
        return sonnerToast.loading(message, {
          duration: Number.POSITIVE_INFINITY,
          className:
            "bg-[var(--surface-1)] border-[var(--border-hairline)] text-[var(--text-high)]",
        });
      },

      /**
       * Update an existing toast
       */
      update: (
        id: string | number,
        data: {
          title?: string;
          description?: string;
          type?: "success" | "error" | "info" | "warning" | "loading";
        }
      ) => {
        sonnerToast.dismiss(id);
        if (data.type === "success") {
          this.success(data.title || "", {
            description: data.description,
          });
        } else if (data.type === "error") {
          this.error(data.title || "", {
            description: data.description,
          });
        } else if (data.type === "warning") {
          this.warning(data.title || "", {
            description: data.description,
          });
        } else {
          this.info(data.title || "", {
            description: data.description,
          });
        }
      },

      /**
       * Dismiss a toast by ID
       */
      dismiss: (id?: string | number) => {
        sonnerToast.dismiss(id);
      },

      /**
       * Dismiss all toasts
       */
      dismissAll: () => {
        sonnerToast.dismiss();
      },
    };
  }, []); // Empty deps - these functions don't depend on any changing state
}
