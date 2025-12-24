import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  colorTransition,
  focusStateSmooth,
  buttonHoverScale,
  disabledState,
} from "../../../lib/animations";

export interface HDButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  loading?: boolean;
}

const sizeStyles = {
  default: "px-4 h-8",
  sm: "px-3 h-7 text-xs",
  lg: "px-6 h-10",
  icon: "h-8 w-8 p-0",
};

export const HDButton = forwardRef<HTMLButtonElement, HDButtonProps>(
  (
    { className, variant = "primary", size = "default", loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium",
          sizeStyles[size],
          colorTransition,
          focusStateSmooth,
          disabledState,
          variant === "primary" && [
            "bg-[var(--brand-primary)] text-[var(--bg-base)] shadow-sm",
            "hover:bg-[var(--brand-primary-hover)] hover:shadow-md",
            "active:bg-[var(--brand-primary-pressed)] active:shadow-sm",
          ],
          variant === "secondary" && [
            "bg-[var(--surface-2)] text-[var(--text-high)] border border-[var(--border-hairline)]",
            "hover:bg-[var(--surface-3)] hover:border-[var(--border-focus)]",
            "active:bg-[var(--surface-2)]",
          ],
          variant === "ghost" && [
            "text-[var(--text-muted)]",
            "hover:text-[var(--text-high)] hover:bg-[var(--surface-2)]",
            "active:bg-[var(--surface-3)]",
          ],
          variant === "outline" && [
            "border border-[var(--border-hairline)] bg-transparent text-[var(--text-high)]",
            "hover:bg-[var(--surface-2)] hover:border-[var(--border-focus)]",
            "active:bg-[var(--surface-3)]",
          ],
          variant === "destructive" && [
            "bg-[var(--accent-negative)] text-white",
            "hover:bg-[var(--accent-negative)]/90",
            "active:bg-[var(--accent-negative)]/80",
          ],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {children}
      </button>
    );
  }
);

HDButton.displayName = "HDButton";
