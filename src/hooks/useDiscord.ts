import { useState } from "react";
import { discordWebhook, sendToMultipleChannels } from "../lib/discord/webhook";
import type { DiscordChannel, Trade, Challenge } from "../types";

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
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      // Use price overrides if provided (user-edited values), otherwise fall back to trade values
      const effectiveTargetPrice = priceOverrides?.targetPrice ?? trade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;
      const effectiveTargetUnderlying =
        priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice;
      const effectiveStopUnderlying =
        priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice;

      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendLoadAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          tradeType: trade.tradeType,
          price: trade.contract.mid,
          targetPrice: effectiveTargetPrice,
          stopLoss: effectiveStopLoss,
          notes,
          // Format C: Underlying price context for TP/SL display
          underlyingPrice: trade.underlyingPriceAtLoad,
          targetUnderlyingPrice: effectiveTargetUnderlying,
          stopUnderlyingPrice: effectiveStopUnderlying,
          // Enhanced fields
          dte: trade.contract.daysToExpiry,
          delta: trade.contract.delta,
          iv: trade.contract.iv,
          setupType: trade.setupType,
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
    imageUrl?: string,
    challengeInfo?: { name: string },
    priceOverrides?: {
      entryPrice?: number;
      targetPrice?: number;
      stopLoss?: number;
      targetUnderlyingPrice?: number;
      stopUnderlyingPrice?: number;
    }
  ) => {
    setSending(true);
    try {
      const webhookUrls = channels.map((ch) => ch.webhookUrl);
      // Use price overrides if provided (user-edited values), otherwise fall back to trade values
      const effectiveEntryPrice = priceOverrides?.entryPrice ?? trade.entryPrice!;
      const effectiveTargetPrice = priceOverrides?.targetPrice ?? trade.targetPrice;
      const effectiveStopLoss = priceOverrides?.stopLoss ?? trade.stopLoss;
      const effectiveTargetUnderlying =
        priceOverrides?.targetUnderlyingPrice ?? trade.targetUnderlyingPrice;
      const effectiveStopUnderlying =
        priceOverrides?.stopUnderlyingPrice ?? trade.stopUnderlyingPrice;

      const results = await sendToMultipleChannels(webhookUrls, (client, url) =>
        client.sendEntryAlert(url, {
          ticker: trade.ticker,
          strike: trade.contract.strike,
          expiry: trade.contract.expiry,
          type: trade.contract.type,
          tradeType: trade.tradeType,
          entryPrice: effectiveEntryPrice,
          targetPrice: effectiveTargetPrice,
          stopLoss: effectiveStopLoss,
          notes,
          imageUrl,
          challengeInfo,
          // Format C: Underlying price context for TP/SL display
          underlyingPrice: trade.underlyingPriceAtLoad ?? trade.underlyingAtEntry,
          targetUnderlyingPrice: effectiveTargetUnderlying,
          stopUnderlyingPrice: effectiveStopUnderlying,
          // Enhanced fields
          dte: trade.contract.daysToExpiry,
          delta: trade.contract.delta,
          iv: trade.contract.iv,
          setupType: trade.setupType,
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
