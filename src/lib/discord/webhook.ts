// Discord Webhook Client
// Sends formatted trade alerts to Discord channels

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
  image?: {
    url: string;
  };
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

// Color scheme for different alert types
export const DISCORD_COLORS = {
  load: 0x3498db, // Blue
  enter: 0x2ecc71, // Green
  update: 0xf39c12, // Orange
  trim: 0xe67e22, // Dark orange
  exit: 0x9b59b6, // Purple
  profit: 0x27ae60, // Profit green
  loss: 0xe74c3c, // Loss red
  info: 0x95a5a6, // Gray
  // Escalation severity colors
  escalation_info: 0x16a34a, // Green
  escalation_warning: 0xf59e0b, // Yellow/Amber
  escalation_urgent: 0xf97316, // Orange
  escalation_critical: 0xef4444, // Red
};

class DiscordWebhookClient {
  private async sendMessageOnce(webhookUrl: string, message: DiscordMessage): Promise<boolean> {
    // Call backend proxy instead of Discord directly to avoid CSP violations
    const response = await fetch("/api/discord/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhookUrl,
        payload: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Discord webhook failed: ${errorData.error || response.statusText}`);
    }

    return true;
  }

  async sendMessage(webhookUrl: string, message: DiscordMessage, retries = 1): Promise<boolean> {
    try {
      return await this.sendMessageOnce(webhookUrl, message);
    } catch (error) {
      console.error("[Discord] First attempt failed:", error);

      // Retry once if retries > 0
      if (retries > 0) {
        console.log("[Discord] Retrying...");
        try {
          return await this.sendMessageOnce(webhookUrl, message);
        } catch (retryError) {
          console.error("[Discord] Retry failed:", retryError);
          return false;
        }
      }

      return false;
    }
  }

  // Test webhook with a simple message
  async testWebhook(webhookUrl: string): Promise<boolean> {
    return this.sendMessage(webhookUrl, {
      content: "✅ Honey Drip webhook test successful!",
      embeds: [
        {
          description: "Your Discord channel is connected and ready to receive trade alerts.",
          color: DISCORD_COLORS.info,
          footer: {
            text: "Honey Drip Trading Platform",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Send a load alert
  async sendLoadAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      strike: number;
      expiry: string;
      type: "C" | "P";
      tradeType: string;
      price: number;
      targetPrice?: number;
      stopLoss?: number;
      notes?: string;
      // Enhanced fields
      dte?: number;
      riskReward?: number;
      delta?: number;
      iv?: number;
      underlyingPrice?: number;
      setupType?: string;
    }
  ): Promise<boolean> {
    const optionType = data.type === "C" ? "Call" : "Put";

    // DTE badge in title
    const dteBadge =
      data.dte !== undefined
        ? data.dte === 0
          ? " ⚠️ 0DTE"
          : data.dte <= 2
            ? ` 🔥 ${data.dte}DTE`
            : ` 📅 ${data.dte}DTE`
        : "";

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Option", value: `$${data.strike} ${optionType}`, inline: true },
      { name: "Expiry", value: data.expiry, inline: true },
      { name: "Trade Type", value: data.tradeType, inline: true },
    ];

    // Underlying price context
    if (data.underlyingPrice) {
      fields.push({
        name: `${data.ticker} Price`,
        value: `$${data.underlyingPrice.toFixed(2)}`,
        inline: true,
      });
    }

    fields.push({ name: "Current Price", value: `$${data.price.toFixed(2)}`, inline: true });

    if (data.targetPrice) {
      fields.push({ name: "🎯 Target", value: `$${data.targetPrice.toFixed(2)}`, inline: true });
    }

    if (data.stopLoss) {
      fields.push({ name: "🛡️ Stop Loss", value: `$${data.stopLoss.toFixed(2)}`, inline: true });
    }

    // Risk/Reward ratio
    if (data.riskReward) {
      const rrRating =
        data.riskReward >= 3 ? "🔥 Excellent" : data.riskReward >= 2 ? "✅ Good" : "⚠️ Fair";
      fields.push({
        name: "R:R Ratio",
        value: `${data.riskReward.toFixed(1)}:1 ${rrRating}`,
        inline: true,
      });
    }

    // Greeks
    if (data.delta !== undefined || data.iv !== undefined) {
      const greeksValue = [
        data.delta !== undefined ? `Δ ${(data.delta * 100).toFixed(0)}` : "",
        data.iv !== undefined ? `IV ${(data.iv * 100).toFixed(0)}%` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      if (greeksValue) {
        fields.push({ name: "📐 Greeks", value: greeksValue, inline: true });
      }
    }

    // Setup type
    if (data.setupType) {
      fields.push({ name: "📋 Setup", value: data.setupType, inline: true });
    }

    if (data.notes) {
      fields.push({ name: "💭 Notes", value: data.notes, inline: false });
    }

    return this.sendMessage(webhookUrl, {
      embeds: [
        {
          title: `📊 LOADING: ${data.ticker}${dteBadge}`,
          color: DISCORD_COLORS.load,
          fields,
          footer: {
            text: "Honey Drip • Load Alert",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Send an entry alert
  async sendEntryAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      strike: number;
      expiry: string;
      type: "C" | "P";
      tradeType: string;
      entryPrice: number;
      targetPrice?: number;
      stopLoss?: number;
      notes?: string;
      imageUrl?: string;
      // Enhanced fields
      dte?: number;
      riskReward?: number;
      delta?: number;
      iv?: number;
      underlyingPrice?: number;
      setupType?: string;
    }
  ): Promise<boolean> {
    const optionType = data.type === "C" ? "Call" : "Put";

    // DTE badge in title
    const dteBadge =
      data.dte !== undefined
        ? data.dte === 0
          ? " ⚠️ 0DTE"
          : data.dte <= 2
            ? ` 🔥 ${data.dte}DTE`
            : ` 📅 ${data.dte}DTE`
        : "";

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Option", value: `$${data.strike} ${optionType}`, inline: true },
      { name: "Expiry", value: data.expiry, inline: true },
      { name: "Trade Type", value: data.tradeType, inline: true },
    ];

    // Underlying price context
    if (data.underlyingPrice) {
      fields.push({
        name: `${data.ticker} Price`,
        value: `$${data.underlyingPrice.toFixed(2)}`,
        inline: true,
      });
    }

    fields.push({ name: "✅ Entry Price", value: `$${data.entryPrice.toFixed(2)}`, inline: true });

    if (data.targetPrice) {
      fields.push({ name: "🎯 Target", value: `$${data.targetPrice.toFixed(2)}`, inline: true });
    }

    if (data.stopLoss) {
      fields.push({ name: "🛡️ Stop Loss", value: `$${data.stopLoss.toFixed(2)}`, inline: true });
    }

    // Risk/Reward ratio
    if (data.riskReward) {
      const rrRating =
        data.riskReward >= 3 ? "🔥 Excellent" : data.riskReward >= 2 ? "✅ Good" : "⚠️ Fair";
      fields.push({
        name: "R:R Ratio",
        value: `${data.riskReward.toFixed(1)}:1 ${rrRating}`,
        inline: true,
      });
    }

    // Greeks
    if (data.delta !== undefined || data.iv !== undefined) {
      const greeksValue = [
        data.delta !== undefined ? `Δ ${(data.delta * 100).toFixed(0)}` : "",
        data.iv !== undefined ? `IV ${(data.iv * 100).toFixed(0)}%` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      if (greeksValue) {
        fields.push({ name: "📐 Greeks", value: greeksValue, inline: true });
      }
    }

    // Setup type
    if (data.setupType) {
      fields.push({ name: "📋 Setup", value: data.setupType, inline: true });
    }

    if (data.notes) {
      fields.push({ name: "💭 Notes", value: data.notes, inline: false });
    }

    const embed: DiscordEmbed = {
      title: `🚀 ENTERED: ${data.ticker}${dteBadge}`,
      color: DISCORD_COLORS.enter,
      fields,
      footer: {
        text: "Honey Drip • Entry Alert",
      },
      timestamp: new Date().toISOString(),
    };

    if (data.imageUrl) {
      embed.image = { url: data.imageUrl };
    }

    return this.sendMessage(webhookUrl, { embeds: [embed] });
  }

  // Send an update alert
  async sendUpdateAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      strike: number;
      expiry: string;
      type: "C" | "P";
      updateType: "trim" | "update-sl" | "generic";
      entryPrice: number;
      currentPrice: number;
      pnlPercent: number;
      message: string;
      imageUrl?: string;
    }
  ): Promise<boolean> {
    const optionType = data.type === "C" ? "Call" : "Put";
    const pnlSign = data.pnlPercent >= 0 ? "+" : "";
    const pnlColor = data.pnlPercent >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;

    let title = "";
    let color = DISCORD_COLORS.update;

    switch (data.updateType) {
      case "trim":
        title = `📉 TRIM: ${data.ticker}`;
        color = DISCORD_COLORS.trim;
        break;
      case "update-sl":
        title = `🛡️ STOP UPDATED: ${data.ticker}`;
        break;
      default:
        title = `📝 UPDATE: ${data.ticker}`;
    }

    const embed: DiscordEmbed = {
      title,
      description: data.message,
      color,
      fields: [
        { name: "Option", value: `$${data.strike} ${optionType}`, inline: true },
        { name: "Entry", value: `$${data.entryPrice.toFixed(2)}`, inline: true },
        { name: "Current", value: `$${data.currentPrice.toFixed(2)}`, inline: true },
        { name: "P/L", value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
      ],
      footer: {
        text: "Honey Drip • Update Alert",
      },
      timestamp: new Date().toISOString(),
    };

    if (data.imageUrl) {
      embed.image = { url: data.imageUrl };
    }

    return this.sendMessage(webhookUrl, { embeds: [embed] });
  }

  // Send an exit alert
  async sendExitAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      strike: number;
      expiry: string;
      type: "C" | "P";
      entryPrice: number;
      exitPrice: number;
      pnlPercent: number;
      notes?: string;
      imageUrl?: string;
    }
  ): Promise<boolean> {
    const optionType = data.type === "C" ? "Call" : "Put";
    const pnlSign = data.pnlPercent >= 0 ? "+" : "";
    const pnlColor = data.pnlPercent >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;
    const emoji = data.pnlPercent >= 0 ? "🎉" : "🔴";

    const fields = [
      { name: "Option", value: `$${data.strike} ${optionType}`, inline: true },
      { name: "Entry", value: `$${data.entryPrice.toFixed(2)}`, inline: true },
      { name: "Exit", value: `$${data.exitPrice.toFixed(2)}`, inline: true },
      { name: "P/L", value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
    ];

    if (data.notes) {
      fields.push({ name: "Notes", value: data.notes, inline: false });
    }

    const embed: DiscordEmbed = {
      title: `${emoji} EXITED: ${data.ticker}`,
      color: pnlColor,
      fields,
      footer: {
        text: "Honey Drip • Exit Alert",
      },
      timestamp: new Date().toISOString(),
    };

    if (data.imageUrl) {
      embed.image = { url: data.imageUrl };
    }

    return this.sendMessage(webhookUrl, { embeds: [embed] });
  }

  // Send a trailing stop alert
  async sendTrailingStopAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      strike: number;
      expiry: string;
      type: "C" | "P";
      entryPrice: number;
      currentPrice: number;
      stopLoss: number;
      pnlPercent: number;
    }
  ): Promise<boolean> {
    const optionType = data.type === "C" ? "Call" : "Put";
    const pnlSign = data.pnlPercent >= 0 ? "+" : "";

    return this.sendMessage(webhookUrl, {
      embeds: [
        {
          title: `🎯 TRAILING STOP: ${data.ticker}`,
          color: DISCORD_COLORS.update,
          fields: [
            { name: "Option", value: `$${data.strike} ${optionType}`, inline: true },
            { name: "Entry", value: `$${data.entryPrice.toFixed(2)}`, inline: true },
            { name: "Current", value: `$${data.currentPrice.toFixed(2)}`, inline: true },
            { name: "New Stop", value: `$${data.stopLoss.toFixed(2)}`, inline: true },
            { name: "P/L", value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
          ],
          footer: {
            text: "Honey Drip • Trailing Stop",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Send a challenge progress alert
  async sendChallengeProgressAlert(
    webhookUrl: string,
    data: {
      challengeName: string;
      startingBalance: number;
      currentBalance: number;
      targetBalance: number;
      totalPnL: number;
      winRate: number;
      completedTrades: number;
      activeTrades: number;
      startDate: string;
      endDate: string;
    }
  ): Promise<boolean> {
    const progress =
      data.targetBalance > 0
        ? ((data.currentBalance - data.startingBalance) /
            (data.targetBalance - data.startingBalance)) *
          100
        : 0;

    const pnlSign = data.totalPnL >= 0 ? "+" : "";
    const pnlColor = data.totalPnL >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;

    // Progress bar emoji representation
    const totalBars = 10;
    const filledBars = Math.round((Math.min(progress, 100) / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    const progressBar = "🟩".repeat(filledBars) + "⬜".repeat(emptyBars);

    // Emoji based on progress
    let emoji = "🎯";
    if (progress >= 100) emoji = "🏆";
    else if (progress >= 75) emoji = "🔥";
    else if (progress >= 50) emoji = "📈";

    const fields = [
      {
        name: "Progress",
        value: `${progressBar}\n${progress.toFixed(1)}% to target`,
        inline: false,
      },
      {
        name: "Starting Balance",
        value: `$${data.startingBalance.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Current Balance",
        value: `$${data.currentBalance.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Target Balance",
        value: `$${data.targetBalance.toFixed(2)}`,
        inline: true,
      },
      {
        name: "Total P&L",
        value: `${pnlSign}$${Math.abs(data.totalPnL).toFixed(2)}`,
        inline: true,
      },
      {
        name: "Win Rate",
        value: `${data.winRate.toFixed(1)}%`,
        inline: true,
      },
      {
        name: "Trades",
        value: `${data.completedTrades} completed, ${data.activeTrades} active`,
        inline: true,
      },
      {
        name: "Duration",
        value: `${data.startDate} → ${data.endDate}`,
        inline: false,
      },
    ];

    return this.sendMessage(webhookUrl, {
      embeds: [
        {
          title: `${emoji} Challenge Update: ${data.challengeName}`,
          color: pnlColor,
          fields,
          footer: {
            text: "Honey Drip • Challenge Progress",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Send a summary alert (for history exports)
  async sendSummaryAlert(
    webhookUrl: string,
    data: {
      title: string;
      summaryText: string;
      comment?: string;
    }
  ): Promise<boolean> {
    // Parse summary text to determine if it's positive or negative performance
    const avgPnLMatch = data.summaryText.match(/Average P&L: ([+-]?\d+\.?\d*)%/);
    const avgPnL = avgPnLMatch ? parseFloat(avgPnLMatch[1]) : 0;
    const pnlColor = avgPnL >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;

    const description = data.comment ? `${data.summaryText}\n\n${data.comment}` : data.summaryText;

    return this.sendMessage(webhookUrl, {
      embeds: [
        {
          title: `📊 ${data.title}`,
          description,
          color: pnlColor,
          footer: {
            text: "Honey Drip • Trade Summary",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  // Send an escalation alert (for urgent/critical alerts)
  async sendEscalationAlert(
    webhookUrl: string,
    data: {
      ticker: string;
      severity: "INFO" | "WARNING" | "URGENT" | "CRITICAL";
      title: string;
      message: string;
      category: string;
      actionLabel?: string;
      metadata?: {
        pnlPercent?: number;
        currentPrice?: number;
        entryPrice?: number;
        stopLoss?: number;
        confluence?: number;
        [key: string]: string | number | boolean | undefined;
      };
    }
  ): Promise<boolean> {
    // Get severity-specific styling
    const severityEmoji = {
      INFO: "🟢",
      WARNING: "🟡",
      URGENT: "🟠",
      CRITICAL: "🔴",
    }[data.severity];

    const severityColor = {
      INFO: DISCORD_COLORS.escalation_info,
      WARNING: DISCORD_COLORS.escalation_warning,
      URGENT: DISCORD_COLORS.escalation_urgent,
      CRITICAL: DISCORD_COLORS.escalation_critical,
    }[data.severity];

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Category", value: data.category.toUpperCase(), inline: true },
      { name: "Severity", value: data.severity, inline: true },
    ];

    // Add metadata fields if provided
    if (data.metadata) {
      if (data.metadata.pnlPercent !== undefined) {
        const pnlSign = data.metadata.pnlPercent >= 0 ? "+" : "";
        fields.push({
          name: "P&L",
          value: `${pnlSign}${data.metadata.pnlPercent.toFixed(1)}%`,
          inline: true,
        });
      }
      if (data.metadata.currentPrice !== undefined) {
        fields.push({
          name: "Current Price",
          value: `$${data.metadata.currentPrice.toFixed(2)}`,
          inline: true,
        });
      }
      if (data.metadata.stopLoss !== undefined) {
        fields.push({
          name: "Stop Loss",
          value: `$${data.metadata.stopLoss.toFixed(2)}`,
          inline: true,
        });
      }
      if (data.metadata.confluence !== undefined) {
        fields.push({
          name: "Confluence",
          value: `${data.metadata.confluence.toFixed(0)}`,
          inline: true,
        });
      }
    }

    // Add action button hint if actionable
    if (data.actionLabel) {
      fields.push({
        name: "Suggested Action",
        value: `**${data.actionLabel}**`,
        inline: false,
      });
    }

    return this.sendMessage(webhookUrl, {
      content:
        data.severity === "CRITICAL"
          ? "@here **CRITICAL ALERT** - Immediate action required!"
          : undefined,
      embeds: [
        {
          title: `${severityEmoji} ${data.title}: ${data.ticker}`,
          description: data.message,
          color: severityColor,
          fields,
          footer: {
            text: `Honey Drip • ${data.severity} Escalation`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}

// Singleton instance
export const discordWebhook = new DiscordWebhookClient();

// Helper function to send to multiple channels
export async function sendToMultipleChannels(
  webhookUrls: string[],
  messageFn: (client: DiscordWebhookClient, url: string) => Promise<boolean>
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    webhookUrls.map((url) => messageFn(discordWebhook, url))
  );

  const success = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failed = results.length - success;

  return { success, failed };
}

/**
 * Send escalation alert to multiple Discord channels
 * Only sends URGENT and CRITICAL alerts by default
 */
export async function sendEscalationToDiscord(
  webhookUrls: string[],
  alert: {
    ticker: string;
    severity: "INFO" | "WARNING" | "URGENT" | "CRITICAL";
    title: string;
    message: string;
    category: string;
    actionLabel?: string;
    metadata?: Record<string, unknown>;
  },
  options: {
    minSeverity?: "INFO" | "WARNING" | "URGENT" | "CRITICAL";
  } = {}
): Promise<{ success: number; failed: number; skipped: boolean }> {
  const { minSeverity = "URGENT" } = options;

  // Define severity levels for comparison
  const severityLevels = { INFO: 1, WARNING: 2, URGENT: 3, CRITICAL: 4 };
  const alertLevel = severityLevels[alert.severity];
  const minLevel = severityLevels[minSeverity];

  // Skip if alert severity is below minimum
  if (alertLevel < minLevel) {
    return { success: 0, failed: 0, skipped: true };
  }

  if (webhookUrls.length === 0) {
    console.log("[Discord] No webhook URLs provided for escalation alert");
    return { success: 0, failed: 0, skipped: true };
  }

  const results = await Promise.allSettled(
    webhookUrls.map((url) =>
      discordWebhook.sendEscalationAlert(url, {
        ticker: alert.ticker,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        category: alert.category,
        actionLabel: alert.actionLabel,
        metadata: alert.metadata as any,
      })
    )
  );

  const success = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failed = results.length - success;

  console.log(
    `[Discord] Escalation alert sent: ${alert.severity} "${alert.title}" to ${success}/${webhookUrls.length} channels`
  );

  return { success, failed, skipped: false };
}
