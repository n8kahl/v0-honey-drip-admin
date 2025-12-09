/**
 * MemberGate.tsx - Content Gating Wrapper
 *
 * Wraps content that should only be visible to members.
 * In demo mode, uses localStorage toggle to switch between views.
 */

import { Lock, ExternalLink, Eye, EyeOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemberStatus } from "@/hooks/useMemberStatus";

// ============================================================================
// MemberGate Component
// ============================================================================

interface MemberGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  blurContent?: boolean;
}

export function MemberGate({ children, fallback, blurContent = false }: MemberGateProps) {
  const { isMember } = useMemberStatus();

  if (isMember) {
    return <>{children}</>;
  }

  // Default fallback - CTA to join Discord
  const defaultFallback = (
    <GatedContentPlaceholder />
  );

  if (blurContent) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-base)]/80">
          {fallback || defaultFallback}
        </div>
      </div>
    );
  }

  return <>{fallback || defaultFallback}</>;
}

// ============================================================================
// Gated Content Placeholder
// ============================================================================

function GatedContentPlaceholder() {
  const discordUrl = import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--surface-1)] rounded-lg border border-[var(--border-hairline)]">
      <Lock className="w-8 h-8 text-[var(--text-muted)] mb-3" />
      <h4 className="font-semibold text-[var(--text-high)] mb-2">
        Members Only Content
      </h4>
      <p className="text-sm text-[var(--text-muted)] mb-4 max-w-sm">
        Join our Discord community to unlock full access to trade details,
        complete alert history, and real-time notifications.
      </p>
      <Button
        onClick={() => window.open(discordUrl, "_blank")}
        className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-black font-semibold"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Join Discord
      </Button>
    </div>
  );
}

// ============================================================================
// Demo View Toggle (Header Component)
// ============================================================================

export function DemoViewToggle() {
  const { isMember, setIsMember } = useMemberStatus();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-[var(--border-hairline)]",
            isMember
              ? "bg-[var(--accent-positive)]/10 border-[var(--accent-positive)]/30 text-[var(--accent-positive)]"
              : "bg-[var(--surface-1)]"
          )}
        >
          {isMember ? (
            <>
              <Eye className="w-4 h-4" />
              Member View
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" />
              Public View
            </>
          )}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setIsMember(false)}
          className={cn(!isMember && "bg-[var(--surface-2)]")}
        >
          <EyeOff className="w-4 h-4 mr-2" />
          Public View
          {!isMember && <span className="ml-auto text-xs text-[var(--text-muted)]">Active</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setIsMember(true)}
          className={cn(isMember && "bg-[var(--surface-2)]")}
        >
          <Eye className="w-4 h-4 mr-2" />
          Member View
          {isMember && <span className="ml-auto text-xs text-[var(--text-muted)]">Active</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Inline Gated Section
// ============================================================================

interface GatedSectionProps {
  title?: string;
  description?: string;
  className?: string;
}

export function GatedSection({ title, description, className }: GatedSectionProps) {
  const discordUrl = import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/honeydrip";

  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-[var(--border-hairline)] p-6 text-center",
        "bg-gradient-to-br from-[var(--surface-1)] to-[var(--surface-2)]/50",
        className
      )}
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-[var(--text-muted)]" />
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {title || "Members Only"}
        </span>
      </div>
      {description && (
        <p className="text-xs text-[var(--text-faint)] mb-3 max-w-xs mx-auto">
          {description}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(discordUrl, "_blank")}
        className="text-xs"
      >
        <ExternalLink className="w-3 h-3 mr-1" />
        Join Discord
      </Button>
    </div>
  );
}

export default MemberGate;
