import { useState } from "react";
import {
  discordWebhook,
  sendToMultipleChannels,
  sendToMultipleChannelsWithResults,
  type MultiChannelSendResults,
  type PerChannelSendResult,
} from "../lib/discord/webhook";
import type { DiscordChannel, Trade, Challenge } from "../types";

// Re-export types for consumers
export type { MultiChannelSendResults, PerChannelSendResult };

export function useDiscord() {
  const [sending, setSending] = useState(false);

  const testWebhook = async (channel: DiscordChannel): Promise<boolean> => {
    try {
      return await discordWebhook.testWebhook(channel.webhookUrl);
    } catch (error) {
      console.error("Test webhook failed:", error);
      return false;
    }
  };

  // Build load alert message payload
  const buildLoadAlertMessage = (
    trade: Trade,
    notes?: string,
    effectiveTargetPrice?: number,
    effectiveStopLoss?: number,
    effectiveTargetUnderlying?: number,
    effectiveStopUnderlying?: number
  ) => {
    const dte = trade.contract.daysToExpiry;
    const dteBadge =
      dte === 0 ? " ⚠️ 0DTE" : dte && dte <= 2 ? ` 🔥 ${dte}DTE` : dte ? ` 📅 ${dte}DTE` : "";
    const optionType = trade.contract.type === "C" ? "Call" : "Put";

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Option", value: `$${trade.contract.strike} ${optionType}`, inline: true },
      { name: "Expiry", value: trade.contract.expiry, inline: true },
      { name: "Trade Type", value: trade.tradeType, inline: true },
    ];

    if (trade.underlyingPriceAtLoad) {
      fields.push({
        name: `${trade.ticker} Price`,
        value: `$${trade.underlyingPriceAtLoad.toFixed(2)}`,
        inline: true,
      });
    }
    fields.push({
      name: "Current Price",
      value: `$${trade.contract.mid.toFixed(2)}`,
      inline: true,
    });

    if (effectiveTargetPrice) {
      const targetValue = effectiveTargetUnderlying
        ? `$${effectiveTargetPrice.toFixed(2)} | ${trade.ticker} @ $${effectiveTargetUnderlying.toFixed(2)}`
        : `$${effectiveTargetPrice.toFixed(2)}`;
      fields.push({ name: "🎯 Target", value: targetValue, inline: true });
    }
    if (effectiveStopLoss) {
      const stopValue = effectiveStopUnderlying
        ? `$${effectiveStopLoss.toFixed(2)} | ${trade.ticker} @ $${effectiveStopUnderlying.toFixed(2)}`
        : `$${effectiveStopLoss.toFixed(2)}`;
      fields.push({ name: "🛡️ Stop Loss", value: stopValue, inline: true });
    }
    if (notes) {
      fields.push({ name: "💭 Notes", value: notes, inline: false });
    }

    return {
      embeds: [
        {
          title: `📊 LOADING: ${trade.ticker}${dteBadge}`,
          color: 0x3498db,
          fields,
          footer: { text: "Honey Drip • Load Alert" },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  };

  const sendLoadAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    notes?: string,
    priceOverrides?: {
      targetPrice?: number;
      stopLoss?: number;
      targetUnderlyingPrice?: number;
      stopUnderlyingPrice?: number;
    }
  ): Promise<MultiChannelSendResults> => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const effectiveTargetPrice = priceOverrides?.targetPrice ?? trade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;
      const effectiveTargetUnderlying =
        priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice;
      const effectiveStopUnderlying =
        priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice;

      const message = buildLoadAlertMessage(
        trade,
        notes,
        effectiveTargetPrice,
        effectiveStopLoss,
        effectiveTargetUnderlying,
        effectiveStopUnderlying
      );

      const results = await sendToMultipleChannelsWithResults(webhookUrls, (client, url) =>
        client.sendMessage(url, message)
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  // Build entry alert message payload
  const buildEntryAlertMessage = (
    trade: Trade,
    effectiveEntryPrice: number,
    effectiveTargetPrice?: number,
    effectiveStopLoss?: number,
    effectiveTargetUnderlying?: number,
    effectiveStopUnderlying?: number,
    notes?: string,
    imageUrl?: string,
    challengeInfo?: { name: string }
  ) => {
    const dte = trade.contract.daysToExpiry;
    const dteBadge =
      dte === 0 ? " ⚠️ 0DTE" : dte && dte <= 2 ? ` 🔥 ${dte}DTE` : dte ? ` 📅 ${dte}DTE` : "";
    const optionType = trade.contract.type === "C" ? "Call" : "Put";
    const underlyingPrice = trade.underlyingPriceAtLoad ?? trade.underlyingAtEntry;

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: "Option", value: `$${trade.contract.strike} ${optionType}`, inline: true },
      { name: "Expiry", value: trade.contract.expiry, inline: true },
      { name: "Trade Type", value: trade.tradeType, inline: true },
    ];

    if (underlyingPrice) {
      fields.push({
        name: `${trade.ticker} Price`,
        value: `$${underlyingPrice.toFixed(2)}`,
        inline: true,
      });
    }
    fields.push({
      name: "✅ Entry Price",
      value: `$${effectiveEntryPrice.toFixed(2)}`,
      inline: true,
    });

    if (effectiveTargetPrice) {
      const targetValue = effectiveTargetUnderlying
        ? `$${effectiveTargetPrice.toFixed(2)} | ${trade.ticker} @ $${effectiveTargetUnderlying.toFixed(2)}`
        : `$${effectiveTargetPrice.toFixed(2)}`;
      fields.push({ name: "🎯 Target", value: targetValue, inline: true });
    }
    if (effectiveStopLoss) {
      const stopValue = effectiveStopUnderlying
        ? `$${effectiveStopLoss.toFixed(2)} | ${trade.ticker} @ $${effectiveStopUnderlying.toFixed(2)}`
        : `$${effectiveStopLoss.toFixed(2)}`;
      fields.push({ name: "🛡️ Stop Loss", value: stopValue, inline: true });
    }
    if (challengeInfo) {
      fields.push({ name: "🏆 Challenge", value: challengeInfo.name, inline: true });
    }
    if (notes) {
      fields.push({ name: "💭 Notes", value: notes, inline: false });
    }

    const embed: any = {
      title: `🚀 ENTERED: ${trade.ticker}${dteBadge}`,
      color: 0x2ecc71,
      fields,
      footer: { text: "Honey Drip • Entry Alert" },
      timestamp: new Date().toISOString(),
    };

    if (imageUrl) {
      embed.image = { url: imageUrl };
    }

    return { embeds: [embed] };
  };

  const sendEntryAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    notes?: string,
    imageUrl?: string,
    challengeInfo?: { name: string },
    priceOverrides?: {
      entryPrice?: number;
      targetPrice?: number;
      stopLoss?: number;
      targetUnderlyingPrice?: number;
      stopUnderlyingPrice?: number;
    }
  ): Promise<MultiChannelSendResults> => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const effectiveEntryPrice = priceOverrides?.entryPrice ?? trade.entryPrice ?? 0;
      const effectiveTargetPrice = priceOverrides?.targetPrice ?? trade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;
      const effectiveTargetUnderlying =
        priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice;
      const effectiveStopUnderlying =
        priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice;

      const message = buildEntryAlertMessage(
        trade,
        effectiveEntryPrice,
        effectiveTargetPrice,
        effectiveStopLoss,
        effectiveTargetUnderlying,
        effectiveStopUnderlying,
        notes,
        imageUrl,
        challengeInfo
      );

      const results = await sendToMultipleChannelsWithResults(webhookUrls, (client, url) =>
        client.sendMessage(url, message)
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendUpdateAlert = async (
    channels: DiscordChannel[],
    trade: Trade,
    updateType: "trim" | "update-sl" | "generic",
    message: string,
    imageUrl?: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendUpdateAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          updateType,
          entryPrice: trade.entryPrice ?? 0,
          currentPrice: trade.currentPrice ?? 0,
          pnlPercent: trade.movePercent ?? 0,
          message,
          imageUrl,
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
    imageUrl?: string,
    challengeInfo?: { name: string; winRate: number; tradeCount: number }
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendExitAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          entryPrice: trade.entryPrice ?? 0,
          exitPrice: trade.exitPrice ?? 0,
          pnlPercent: trade.movePercent ?? 0,
          notes,
          imageUrl,
          challengeInfo,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendTrailingStopAlert = async (channels: DiscordChannel[], trade: Trade) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendTrailingStopAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          entryPrice: trade.entryPrice ?? 0,
          currentPrice: trade.currentPrice ?? 0,
          stopLoss: trade.stopLoss ?? 0,
          pnlPercent: trade.movePercent ?? 0,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendChallengeProgressAlert = async (
    channels: DiscordChannel[],
    challenge: Challenge,
    stats: {
      totalPnL: number;
      winRate: number;
      completedTrades: number;
      activeTrades: number;
    }
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendChallengeProgressAlert(url, {
          challengeName: challenge.name,
          startingBalance: challenge.startingBalance,
          currentBalance: challenge.currentBalance,
          targetBalance: challenge.targetBalance,
          totalPnL: stats.totalPnL,
          winRate: stats.winRate,
          completedTrades: stats.completedTrades,
          activeTrades: stats.activeTrades,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
        })
      );
      return results;
    } finally {
      setSending(false);
    }
  };

  const sendSummaryAlert = async (
    channels: DiscordChannel[],
    title: string,
    summaryText: string,
    comment?: string
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendSummaryAlert(url, {
          title,
          summaryText,
          comment,
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
    sendChallengeProgressAlert,
    sendSummaryAlert,
  };
}
