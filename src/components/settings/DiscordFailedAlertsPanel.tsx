/**
 * Discord Failed Alerts Panel
 *
 * Displays failed Discord webhook deliveries with manual retry option
 * Shows in Settings page under Discord section
 */

import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
import {
  getPendingFailures,
  retryFailedAlert,
  deleteFailure,
  type DiscordFailure,
} from "../../lib/discord/failureLogger";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { AlertCircle, RefreshCw, Trash2, Clock, CheckCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export function DiscordFailedAlertsPanel() {
  const { user } = useAuth();
  const [failures, setFailures] = useState<DiscordFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadFailures();
    }
  }, [user]);

  const loadFailures = async () => {
    if (!user) return;

    setLoading(true);
    const data = await getPendingFailures(user.id);
    setFailures(data);
    setLoading(false);
  };

  const handleRetry = async (failure: DiscordFailure) => {
    setRetrying((prev) => new Set(prev).add(failure.id));

    const result = await retryFailedAlert(failure.id, failure.webhook_url, failure.payload);

    setRetrying((prev) => {
      const next = new Set(prev);
      next.delete(failure.id);
      return next;
    });

    if (result.success) {
      toast.success("Discord alert sent", {
        description: `Alert successfully sent to ${failure.channel_name || "channel"}`,
      });
      // Remove from list after successful retry
      loadFailures();
    } else {
      toast.error("Retry failed", {
        description: result.error || "Discord not responding",
      });
    }
  };

  const handleDelete = async (failure: DiscordFailure) => {
    if (!user) return;

    const result = await deleteFailure(failure.id, user.id);

    if (result.success) {
      toast.success("Failed alert deleted");
      loadFailures();
    } else {
      toast.error("Delete failed", {
        description: result.error || "Could not delete alert",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading failed alerts...</span>
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <Card className="p-4 bg-[var(--surface-1)] border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <CheckCircle className="w-4 h-4 text-[var(--accent-positive)]" />
          <span>No failed Discord alerts</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-high)]">Failed Discord Alerts</h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {failures.length} alert{failures.length !== 1 ? "s" : ""} pending
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadFailures}
          className="text-[var(--text-muted)] hover:text-[var(--text-high)]"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {failures.map((failure) => (
          <Card
            key={failure.id}
            className="p-3 bg-[var(--surface-1)] border-[var(--border-hairline)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                    FAILED
                  </Badge>
                  <span className="text-sm font-medium text-[var(--text-high)] truncate">
                    {failure.channel_name || "Unknown Channel"}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] uppercase">
                    {failure.alert_type}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-muted)] space-y-0.5">
                  {failure.error_message && (
                    <div className="flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-[var(--accent-negative)]" />
                      <span className="break-words">{failure.error_message}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Failed {new Date(failure.failed_at).toLocaleString()}</span>
                  </div>
                  {failure.retried_at && (
                    <div className="text-[var(--text-faint)]">
                      Last retry: {new Date(failure.retried_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(failure)}
                  disabled={retrying.has(failure.id)}
                  className={cn(
                    "h-8 px-3",
                    retrying.has(failure.id) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <RefreshCw
                    className={cn("w-4 h-4 mr-1", retrying.has(failure.id) && "animate-spin")}
                  />
                  Retry
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(failure)}
                  className="h-8 px-3 text-[var(--text-muted)] hover:text-[var(--accent-negative)]"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
