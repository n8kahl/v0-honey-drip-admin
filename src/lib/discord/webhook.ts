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
  load: 0x3498db,      // Blue
  enter: 0x2ecc71,     // Green
  update: 0xf39c12,    // Orange
  trim: 0xe67e22,      // Dark orange
  exit: 0x9b59b6,      // Purple
  profit: 0x27ae60,    // Profit green
  loss: 0xe74c3c,      // Loss red
  info: 0x95a5a6,      // Gray
};

class DiscordWebhookClient {
  async sendMessage(webhookUrl: string, message: DiscordMessage): Promise<boolean> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to send Discord message:', error);
      return false;
    }
  }

  // Test webhook with a simple message
  async testWebhook(webhookUrl: string): Promise<boolean> {
    return this.sendMessage(webhookUrl, {
      content: '✅ Honey Drip webhook test successful!',
      embeds: [{
        description: 'Your Discord channel is connected and ready to receive trade alerts.',
        color: DISCORD_COLORS.info,
        footer: {
          text: 'Honey Drip Trading Platform',
        },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  // Send a load alert
  async sendLoadAlert(webhookUrl: string, data: {
    ticker: string;
    strike: number;
    expiry: string;
    type: 'C' | 'P';
    tradeType: string;
    price: number;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
  }): Promise<boolean> {
    const optionType = data.type === 'C' ? 'Call' : 'Put';
    
    const fields = [
      { name: 'Option', value: `$${data.strike} ${optionType}`, inline: true },
      { name: 'Expiry', value: data.expiry, inline: true },
      { name: 'Trade Type', value: data.tradeType, inline: true },
      { name: 'Current Price', value: `$${data.price.toFixed(2)}`, inline: true },
    ];

    if (data.targetPrice) {
      fields.push({ name: 'Target', value: `$${data.targetPrice.toFixed(2)}`, inline: true });
    }

    if (data.stopLoss) {
      fields.push({ name: 'Stop Loss', value: `$${data.stopLoss.toFixed(2)}`, inline: true });
    }

    if (data.notes) {
      fields.push({ name: 'Notes', value: data.notes, inline: false });
    }

    return this.sendMessage(webhookUrl, {
      embeds: [{
        title: `📊 LOADING: ${data.ticker}`,
        color: DISCORD_COLORS.load,
        fields,
        footer: {
          text: 'Honey Drip • Load Alert',
        },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  // Send an entry alert
  async sendEntryAlert(webhookUrl: string, data: {
    ticker: string;
    strike: number;
    expiry: string;
    type: 'C' | 'P';
    tradeType: string;
    entryPrice: number;
    targetPrice?: number;
    stopLoss?: number;
    notes?: string;
    imageUrl?: string;
  }): Promise<boolean> {
    const optionType = data.type === 'C' ? 'Call' : 'Put';
    
    const fields = [
      { name: 'Option', value: `$${data.strike} ${optionType}`, inline: true },
      { name: 'Expiry', value: data.expiry, inline: true },
      { name: 'Trade Type', value: data.tradeType, inline: true },
      { name: 'Entry Price', value: `$${data.entryPrice.toFixed(2)}`, inline: true },
    ];

    if (data.targetPrice) {
      fields.push({ name: 'Target', value: `$${data.targetPrice.toFixed(2)}`, inline: true });
    }

    if (data.stopLoss) {
      fields.push({ name: 'Stop Loss', value: `$${data.stopLoss.toFixed(2)}`, inline: true });
    }

    if (data.notes) {
      fields.push({ name: 'Notes', value: data.notes, inline: false });
    }

    const embed: DiscordEmbed = {
      title: `🚀 ENTERED: ${data.ticker}`,
      color: DISCORD_COLORS.enter,
      fields,
      footer: {
        text: 'Honey Drip • Entry Alert',
      },
      timestamp: new Date().toISOString(),
    };

    if (data.imageUrl) {
      embed.image = { url: data.imageUrl };
    }

    return this.sendMessage(webhookUrl, { embeds: [embed] });
  }

  // Send an update alert
  async sendUpdateAlert(webhookUrl: string, data: {
    ticker: string;
    strike: number;
    expiry: string;
    type: 'C' | 'P';
    updateType: 'trim' | 'update-sl' | 'generic';
    entryPrice: number;
    currentPrice: number;
    pnlPercent: number;
    message: string;
  }): Promise<boolean> {
    const optionType = data.type === 'C' ? 'Call' : 'Put';
    const pnlSign = data.pnlPercent >= 0 ? '+' : '';
    const pnlColor = data.pnlPercent >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;
    
    let title = '';
    let color = DISCORD_COLORS.update;
    
    switch (data.updateType) {
      case 'trim':
        title = `📉 TRIM: ${data.ticker}`;
        color = DISCORD_COLORS.trim;
        break;
      case 'update-sl':
        title = `🛡️ STOP UPDATED: ${data.ticker}`;
        break;
      default:
        title = `📝 UPDATE: ${data.ticker}`;
    }

    return this.sendMessage(webhookUrl, {
      embeds: [{
        title,
        description: data.message,
        color,
        fields: [
          { name: 'Option', value: `$${data.strike} ${optionType}`, inline: true },
          { name: 'Entry', value: `$${data.entryPrice.toFixed(2)}`, inline: true },
          { name: 'Current', value: `$${data.currentPrice.toFixed(2)}`, inline: true },
          { name: 'P/L', value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
        ],
        footer: {
          text: 'Honey Drip • Update Alert',
        },
        timestamp: new Date().toISOString(),
      }],
    });
  }

  // Send an exit alert
  async sendExitAlert(webhookUrl: string, data: {
    ticker: string;
    strike: number;
    expiry: string;
    type: 'C' | 'P';
    entryPrice: number;
    exitPrice: number;
    pnlPercent: number;
    notes?: string;
    imageUrl?: string;
  }): Promise<boolean> {
    const optionType = data.type === 'C' ? 'Call' : 'Put';
    const pnlSign = data.pnlPercent >= 0 ? '+' : '';
    const pnlColor = data.pnlPercent >= 0 ? DISCORD_COLORS.profit : DISCORD_COLORS.loss;
    const emoji = data.pnlPercent >= 0 ? '🎉' : '🔴';
    
    const fields = [
      { name: 'Option', value: `$${data.strike} ${optionType}`, inline: true },
      { name: 'Entry', value: `$${data.entryPrice.toFixed(2)}`, inline: true },
      { name: 'Exit', value: `$${data.exitPrice.toFixed(2)}`, inline: true },
      { name: 'P/L', value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
    ];

    if (data.notes) {
      fields.push({ name: 'Notes', value: data.notes, inline: false });
    }

    const embed: DiscordEmbed = {
      title: `${emoji} EXITED: ${data.ticker}`,
      color: pnlColor,
      fields,
      footer: {
        text: 'Honey Drip • Exit Alert',
      },
      timestamp: new Date().toISOString(),
    };

    if (data.imageUrl) {
      embed.image = { url: data.imageUrl };
    }

    return this.sendMessage(webhookUrl, { embeds: [embed] });
  }

  // Send a trailing stop alert
  async sendTrailingStopAlert(webhookUrl: string, data: {
    ticker: string;
    strike: number;
    expiry: string;
    type: 'C' | 'P';
    entryPrice: number;
    currentPrice: number;
    stopLoss: number;
    pnlPercent: number;
  }): Promise<boolean> {
    const optionType = data.type === 'C' ? 'Call' : 'Put';
    const pnlSign = data.pnlPercent >= 0 ? '+' : '';
    
    return this.sendMessage(webhookUrl, {
      embeds: [{
        title: `🎯 TRAILING STOP: ${data.ticker}`,
        color: DISCORD_COLORS.update,
        fields: [
          { name: 'Option', value: `$${data.strike} ${optionType}`, inline: true },
          { name: 'Entry', value: `$${data.entryPrice.toFixed(2)}`, inline: true },
          { name: 'Current', value: `$${data.currentPrice.toFixed(2)}`, inline: true },
          { name: 'New Stop', value: `$${data.stopLoss.toFixed(2)}`, inline: true },
          { name: 'P/L', value: `${pnlSign}${data.pnlPercent.toFixed(1)}%`, inline: true },
        ],
        footer: {
          text: 'Honey Drip • Trailing Stop',
        },
        timestamp: new Date().toISOString(),
      }],
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
    webhookUrls.map(url => messageFn(discordWebhook, url))
  );

  const success = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - success;

  return { success, failed };
}
