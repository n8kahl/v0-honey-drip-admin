import { useState } from 'react';
import { discordWebhook, sendToMultipleChannels } from '../lib/discord/webhook';
import type { DiscordChannel, Trade } from '../types';

export function useDiscord() {
  const [sending, setSending] = useState(false);

  const testWebhook = async (channel: DiscordChannel): Promise<boolean> => {
    try {
      return await discordWebhook.testWebhook(channel.webhookUrl);
    } catch (error) {
      console.error('Test webhook failed:', error);
      return false;
    }
  };

  const sendLoadAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    notes?: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map(ch => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendLoadAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          tradeType: trade.tradeType,
          price: trade.contract.mid,
          targetPrice: trade.targetPrice,
          stopLoss: trade.stopLoss,
          notes,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendEntryAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    notes?: string,
    imageUrl?: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map(ch => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendEntryAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          tradeType: trade.tradeType,
          entryPrice: trade.entryPrice!,
          targetPrice: trade.targetPrice,
          stopLoss: trade.stopLoss,
          notes,
          imageUrl,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendUpdateAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    updateType: 'trim' | 'update-sl' | 'generic',
    message: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map(ch => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendUpdateAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          updateType,
          entryPrice: trade.entryPrice!,
          currentPrice: trade.currentPrice!,
          pnlPercent: trade.movePercent!,
          message,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendExitAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    notes?: string,
    imageUrl?: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map(ch => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendExitAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          entryPrice: trade.entryPrice!,
          exitPrice: trade.exitPrice!,
          pnlPercent: trade.movePercent!,
          notes,
          imageUrl,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendTrailingStopAlert = async (
    channels: DiscordChannel[],
    trade: Trade
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map(ch => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendTrailingStopAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          entryPrice: trade.entryPrice!,
          currentPrice: trade.currentPrice!,
          stopLoss: trade.stopLoss!,
          pnlPercent: trade.movePercent!,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  return {
    sending,
    testWebhook,
    sendLoadAlert,
    sendEntryAlert,
    sendUpdateAlert,
    sendExitAlert,
    sendTrailingStopAlert,
  };
}
