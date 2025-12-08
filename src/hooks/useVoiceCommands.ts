import { useState, useCallback, useEffect, useRef } from "react";
import { VoiceHUDState, VoiceCommand } from "../components/hd/HDVoiceHUD";
import { Trade, Ticker, Contract } from "../types";
import { useSettingsStore } from "../stores/settingsStore";
import { generateEntryAlert, SmartAlertResult } from "../lib/services/smartAlertService";
import { useWhisperVoice } from "./useWhisperVoice";
import { useUserSettings } from "./useUserSettings";
import { trackCommand } from "../lib/services/commandTracking";

// Web Speech API types
interface SpeechRecognitionType {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognitionType;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognitionType;
    };
  }
}

export type VoiceActionType =
  | "wake-word"
  | "add-ticker"
  | "remove-ticker"
  | "load-contract"
  | "enter-trade"
  | "trim-trade"
  | "update-sl"
  | "exit-trade"
  | "add-position"
  | "compound" // Multiple actions in sequence
  | "navigate" // Tab navigation
  | "unknown";

export interface ParsedVoiceAction {
  type: VoiceActionType;
  ticker?: string;
  strike?: number;
  optionType?: "C" | "P";
  expiry?: string;
  tradeId?: string;
  price?: number;
  trimPercent?: number;
  subActions?: ParsedVoiceAction[]; // For compound commands
  breakEvenStop?: boolean; // For "move to BE"
  destination?: "live" | "active" | "history" | "settings" | "monitoring"; // For navigate
  extractedContext?: string; // Natural language comment
}

interface UseVoiceCommandsProps {
  watchlist: Ticker[];
  activeTrades: Trade[];
  currentTrade: Trade | null;
  onAddTicker?: (symbol: string) => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onLoadContract?: (contract: Contract, ticker: Ticker, reasoning?: string) => void;
  onEnterTrade?: () => void;
  onTrimTrade?: () => void;
  onUpdateSL?: () => void;
  onExitTrade?: () => void;
  onAddPosition?: () => void;
  onSendAlert?: (alert: SmartAlertResult) => Promise<void>;
  onNavigate?: (destination: "live" | "active" | "history" | "settings" | "monitoring") => void;
}

export function useVoiceCommands({
  watchlist,
  activeTrades,
  currentTrade,
  onAddTicker,
  onRemoveTicker,
  onLoadContract,
  onEnterTrade,
  onTrimTrade,
  onUpdateSL,
  onExitTrade,
  onAddPosition,
  onSendAlert,
  onNavigate,
}: UseVoiceCommandsProps) {
  // Get user settings for voice engine preference
  const { profile } = useUserSettings();
  const voiceEngine = profile?.voiceEngine || "webspeech";

  // Whisper hook (only active when voiceEngine === 'whisper')
  const whisper = useWhisperVoice();

  const [isListening, setIsListening] = useState(false);
  const [hudState, setHudState] = useState<VoiceHUDState | null>(null);
  const [transcript, setTranscript] = useState("");
  const [command, setCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<ParsedVoiceAction | null>(null);
  const [pendingAlert, setPendingAlert] = useState<SmartAlertResult | null>(null);
  const [pendingTickerAdd, setPendingTickerAdd] = useState<{
    symbol: string;
    action: ParsedVoiceAction;
  } | null>(null);
  const [waitingForWakeWord, setWaitingForWakeWord] = useState(true);
  const [pendingCompoundActions, setPendingCompoundActions] = useState<ParsedVoiceAction[]>([]);
  const [compoundActionIndex, setCompoundActionIndex] = useState(0);
  const [awaitingTradeSelection, setAwaitingTradeSelection] = useState<{
    action: ParsedVoiceAction;
    trades: Trade[];
  } | null>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract natural language context from command
  const extractContext = useCallback((text: string): string | undefined => {
    const lowerText = text.toLowerCase();

    // Sizing hints
    if (lowerText.includes("lightly") || lowerText.includes("light")) return "Size lightly";
    if (lowerText.includes("heavily") || lowerText.includes("heavy")) return "Size heavily";
    if (lowerText.includes("small")) return "Small size";
    if (lowerText.includes("large")) return "Large size";
    if (lowerText.includes("half size")) return "Half size";
    if (lowerText.includes("full size")) return "Full size";
    if (lowerText.includes("aggressive")) return "Aggressive sizing";
    if (lowerText.includes("conservative")) return "Conservative sizing";

    // Reasoning
    if (lowerText.includes("resistance")) return "At resistance";
    if (lowerText.includes("support")) return "At support";
    if (lowerText.includes("breakout")) return "Breakout play";
    if (lowerText.includes("reversal")) return "Reversal setup";
    if (lowerText.includes("trend")) return "Following trend";

    // Timing
    if (lowerText.includes("quick scalp")) return "Quick scalp";
    if (lowerText.includes("day trade")) return "Day trade";
    if (lowerText.includes("swing")) return "Swing trade";
    if (lowerText.includes("overnight")) return "Hold overnight";
    if (lowerText.includes("until close")) return "Until close";

    return undefined;
  }, []);

  // Parse voice transcript into action with context awareness
  const parseVoiceCommand = useCallback((text: string): ParsedVoiceAction => {
    const lowerText = text.toLowerCase().trim();

    // Check for wake word
    if (lowerText.includes("hey honey") || lowerText.includes("ok honey")) {
      return { type: "wake-word" };
    }

    // Reserved words to ignore when extracting ticker
    const reservedWords = [
      "hey",
      "honey",
      "ok",
      "add",
      "remove",
      "watchlist",
      "load",
      "contract",
      "enter",
      "go",
      "long",
      "short",
      "buy",
      "take",
      "position",
      "trim",
      "profit",
      "update",
      "stop",
      "loss",
      "sl",
      "exit",
      "close",
      "call",
      "put",
      "dollars",
      "bucks",
      "percent",
      "at",
      "price",
      "target",
    ];

    // Ticker aliases: map company names to ticker symbols
    const tickerAliases: Record<string, string> = {
      apple: "AAPL",
      microsoft: "MSFT",
      google: "GOOGL",
      alphabet: "GOOGL",
      amazon: "AMZN",
      tesla: "TSLA",
      meta: "META",
      facebook: "META",
      netflix: "NFLX",
      nvidia: "NVDA",
      amd: "AMD",
      intel: "INTC",
      disney: "DIS",
      sofi: "SOFI",
      nio: "NIO",
      lucid: "LCID",
      rivian: "RIVN",
      palantir: "PLTR",
      coinbase: "COIN",
      spy: "SPY",
      qqq: "QQQ",
      dia: "DIA",
      iwm: "IWM",
    };

    // Extract ticker - check aliases first, then look for ticker symbols
    const words = lowerText.split(/\s+/);
    let ticker: string | undefined;

    // First check for company name aliases
    for (const word of words) {
      if (tickerAliases[word]) {
        ticker = tickerAliases[word];
        break;
      }
    }

    // If no alias found, find first word that looks like a ticker
    if (!ticker) {
      const potentialTicker = words.find(
        (word) => /^[a-z]{1,5}$/i.test(word) && !reservedWords.includes(word)
      );
      ticker = potentialTicker ? potentialTicker.toUpperCase() : undefined;
    }

    // Extract price if mentioned
    const priceMatch =
      lowerText.match(/(\d+\.?\d*)\s*(dollars?|bucks?)/i) || lowerText.match(/at\s+(\d+\.?\d*)/i);
    const price = priceMatch ? parseFloat(priceMatch[1]) : undefined;

    // Extract percentage for trims
    const percentMatch = lowerText.match(/(\d+)\s*percent/i);
    const trimPercent = percentMatch ? parseInt(percentMatch[1]) : undefined;

    // Add ticker to watchlist - check FIRST before general "add" command
    if (
      lowerText.includes("add") &&
      (lowerText.includes("watchlist") ||
        lowerText.includes("to watchlist") ||
        lowerText.includes("watch list"))
    ) {
      return { type: "add-ticker", ticker };
    }

    // Remove ticker from watchlist
    if (
      lowerText.includes("remove") &&
      (lowerText.includes("watchlist") ||
        lowerText.includes("from watchlist") ||
        lowerText.includes("watch list"))
    ) {
      return { type: "remove-ticker", ticker };
    }

    // Load a contract
    if (lowerText.includes("load")) {
      const strikeMatch = lowerText.match(/(\d+)/);
      const callMatch = lowerText.includes("call");
      const putMatch = lowerText.includes("put");

      return {
        type: "load-contract",
        ticker,
        strike: strikeMatch ? parseInt(strikeMatch[1]) : undefined,
        optionType: callMatch ? "C" : putMatch ? "P" : undefined,
        price,
      };
    }

    // Enter trade - natural variations
    if (
      lowerText.includes("enter") ||
      lowerText.includes("go long") ||
      lowerText.includes("go short") ||
      lowerText.includes("buy") ||
      lowerText.includes("take position")
    ) {
      const isShort = lowerText.includes("short") || lowerText.includes("put");
      const context = extractContext(text);
      return {
        type: "enter-trade",
        ticker,
        price,
        optionType: isShort ? "P" : "C",
        extractedContext: context,
      };
    }

    // Trim position
    if (lowerText.includes("trim") || lowerText.includes("take profit")) {
      return { type: "trim-trade", ticker, trimPercent };
    }

    // Update stop loss (detect break even)
    if (lowerText.includes("update") && (lowerText.includes("stop") || lowerText.includes("sl"))) {
      const breakEven =
        lowerText.includes("break even") ||
        lowerText.includes("breakeven") ||
        lowerText.includes("break-even") ||
        lowerText.includes("b/e") ||
        lowerText.includes(" be ");
      return { type: "update-sl", ticker, price, breakEvenStop: breakEven };
    }

    // Move stop to break even (shorthand)
    if (
      (lowerText.includes("move") || lowerText.includes("set")) &&
      lowerText.includes("stop") &&
      (lowerText.includes("break even") ||
        lowerText.includes("breakeven") ||
        lowerText.includes("break-even"))
    ) {
      return { type: "update-sl", ticker, breakEvenStop: true };
    }

    // Exit trade
    if (lowerText.includes("exit") || lowerText.includes("close")) {
      return { type: "exit-trade", ticker };
    }

    // Add to position - only if NOT adding to watchlist
    if (
      lowerText.includes("add") &&
      !lowerText.includes("watchlist") &&
      !lowerText.includes("watch list") &&
      (lowerText.includes("position") ||
        lowerText.includes("more") ||
        lowerText.includes("contracts"))
    ) {
      return { type: "add-position", ticker, price };
    }

    // Navigation commands
    if (lowerText.includes("go to") || lowerText.includes("show") || lowerText.includes("open")) {
      if (lowerText.includes("active") || lowerText.includes("trade")) {
        return { type: "navigate", destination: "active" };
      }
      if (lowerText.includes("history") || lowerText.includes("review")) {
        return { type: "navigate", destination: "history" };
      }
      if (lowerText.includes("settings")) {
        return { type: "navigate", destination: "settings" };
      }
      if (lowerText.includes("monitoring") || lowerText.includes("monitor")) {
        return { type: "navigate", destination: "monitoring" };
      }
      if (lowerText.includes("watchlist") || lowerText.includes("live")) {
        return { type: "navigate", destination: "live" };
      }
    }

    // Detect compound commands with "and" separator (parse recursively)
    if (lowerText.includes(" and ")) {
      const parts = lowerText.split(" and ").map((p) => p.trim());
      const subActions: ParsedVoiceAction[] = [];

      for (const part of parts) {
        // Recursively parse each part
        const subAction = parseVoiceCommand(part);
        if (subAction.type !== "unknown") {
          subActions.push(subAction);
        }
      }

      if (subActions.length > 1) {
        return {
          type: "compound",
          ticker,
          subActions,
        };
      }
    }

    return { type: "unknown", ticker };
  }, []);

  // Create voice command object for display with smart alert preview
  const createVoiceCommand = useCallback(
    (action: ParsedVoiceAction, text: string, alert?: SmartAlertResult | null): VoiceCommand => {
      switch (action.type) {
        case "wake-word":
          return {
            transcript: text,
            action: "Listening",
            details: "Say your command now",
          };

        case "add-ticker":
          return {
            transcript: text,
            action: `Add ${action.ticker} to watchlist`,
            details: `Will add ${action.ticker} to your watchlist`,
          };

        case "remove-ticker":
          return {
            transcript: text,
            action: `Remove ${action.ticker} from watchlist`,
            details: `Will remove ${action.ticker} from your watchlist`,
          };

        case "load-contract": {
          const contractDesc = `${action.ticker}${action.strike ? ` ${action.strike}` : ""}${action.optionType || ""}`;
          return {
            transcript: text,
            action: `Load ${contractDesc} contract`,
            details: `Will load this contract as a trade idea`,
          };
        }

        case "enter-trade":
          if (alert) {
            return {
              transcript: text,
              action: "Generate Entry Alert",
              details: alert.reasoning,
            };
          }
          return {
            transcript: text,
            action: "Enter trade",
            details: currentTrade
              ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}`
              : "Searching for best contract...",
          };

        case "trim-trade":
          if (alert) {
            return {
              transcript: text,
              action: "Generate Trim Alert",
              details: alert.reasoning,
            };
          }
          return {
            transcript: text,
            action: "Trim position",
            details: currentTrade
              ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}`
              : "No active trade",
          };

        case "update-sl":
          if (alert) {
            return {
              transcript: text,
              action: "Update Stop Loss",
              details: alert.reasoning,
            };
          }
          return {
            transcript: text,
            action: "Update stop loss",
            details: currentTrade
              ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}`
              : "No active trade",
          };

        case "exit-trade":
          if (alert) {
            return {
              transcript: text,
              action: "Generate Exit Alert",
              details: alert.reasoning,
            };
          }
          return {
            transcript: text,
            action: "Exit trade",
            details: currentTrade
              ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}`
              : "No active trade",
          };

        case "add-position":
          return {
            transcript: text,
            action: "Add to position",
            details: currentTrade
              ? `${currentTrade.ticker} ${currentTrade.contract.strike}${currentTrade.contract.type}`
              : "No active trade",
          };

        default:
          return {
            transcript: text,
            action: "Command not recognized",
            details: "Try: 'Enter SPY' or 'Trim current trade'",
          };
      }
    },
    [currentTrade]
  );

  // Text-to-speech helper
  const speak = useCallback((text: string) => {
    if (!synthRef.current) {
      synthRef.current = window.speechSynthesis;
    }

    const voiceSettings = useSettingsStore.getState();
    if (!voiceSettings.voiceAudioFeedback) {
      return; // TTS disabled
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster
    utterance.pitch = 1.0;
    synthRef.current.speak(utterance);
  }, []);

  // Select trade for action with disambiguation
  const selectTradeForAction = useCallback(
    (action: ParsedVoiceAction): Trade | null | "needs-clarification" => {
      // If ticker specified, find that specific trade
      if (action.ticker) {
        const trades = activeTrades.filter(
          (t) => t.state === "ENTERED" && t.ticker === action.ticker
        );

        if (trades.length === 0) {
          speak(`No active ${action.ticker} trade found`);
          setError(`No active ${action.ticker} trade`);
          return null;
        }
        if (trades.length === 1) {
          return trades[0];
        }
        // Multiple trades for same ticker - need clarification
        setAwaitingTradeSelection({ action, trades });
        const tickerList = trades
          .map(
            (t, i) =>
              `${i + 1}: ${t.contract.strike} ${t.contract.optionType === "C" ? "call" : "put"}`
          )
          .join(", ");
        speak(`You have ${trades.length} ${action.ticker} trades. ${tickerList}. Which one?`);
        setHudState("confirming");
        return "needs-clarification";
      }

      // No ticker specified - use currentTrade or ask
      if (currentTrade && currentTrade.state === "ENTERED") {
        return currentTrade;
      }

      const enteredTrades = activeTrades.filter((t) => t.state === "ENTERED");
      if (enteredTrades.length === 0) {
        speak("No active trades found");
        setError("No active trades");
        return null;
      }
      if (enteredTrades.length === 1) {
        return enteredTrades[0];
      }

      // Multiple trades - need clarification
      setAwaitingTradeSelection({ action, trades: enteredTrades });
      const tradeList = enteredTrades.map((t, i) => `${i + 1}: ${t.ticker}`).join(", ");
      speak(`You have ${enteredTrades.length} active trades: ${tradeList}. Which one?`);
      setHudState("confirming");
      return "needs-clarification";
    },
    [activeTrades, currentTrade, speak]
  );

  // Handle trade selection response
  const handleTradeSelectionResponse = useCallback(
    (response: string) => {
      if (!awaitingTradeSelection) return;

      const lowerResponse = response.toLowerCase().trim();
      const { action, trades } = awaitingTradeSelection;

      // Check for numeric response (1, 2, 3, etc.)
      const numMatch = lowerResponse.match(/(\d+)/);
      if (numMatch) {
        const index = parseInt(numMatch[1]) - 1;
        if (index >= 0 && index < trades.length) {
          const selectedTrade = trades[index];
          speak(`Selected ${selectedTrade.ticker}`);

          // Execute action with selected trade
          const updatedAction = {
            ...action,
            ticker: selectedTrade.ticker,
            tradeId: selectedTrade.id,
          };
          setAwaitingTradeSelection(null);
          executeAction(updatedAction);
          return;
        }
      }

      // Check for ticker mention
      for (const trade of trades) {
        if (lowerResponse.includes(trade.ticker.toLowerCase())) {
          speak(`Selected ${trade.ticker}`);
          const updatedAction = { ...action, ticker: trade.ticker, tradeId: trade.id };
          setAwaitingTradeSelection(null);
          executeAction(updatedAction);
          return;
        }
      }

      speak("I didn't understand. Please say the number or ticker symbol.");
    },
    [awaitingTradeSelection, speak]
  );

  // Execute the confirmed action with smart alert generation
  const executeAction = useCallback(
    async (action: ParsedVoiceAction, transcriptText?: string) => {
      try {
        setHudState("processing");
        const currentTranscript = transcriptText || transcript;

        switch (action.type) {
          case "wake-word":
            setWaitingForWakeWord(false);
            speak("Listening");
            setHudState("listening");
            break;

          case "add-ticker":
            if (action.ticker && onAddTicker) {
              onAddTicker(action.ticker);
              speak(`Added ${action.ticker} to watchlist`);
            }
            break;

          case "remove-ticker":
            if (action.ticker && onRemoveTicker) {
              const ticker = watchlist.find((t) => t.symbol === action.ticker);
              if (ticker) {
                onRemoveTicker(ticker);
                speak(`Removed ${action.ticker} from watchlist`);
              }
            }
            break;

          case "load-contract":
            console.warn("[v0] Load contract action:", action);
            break;

          case "enter-trade": {
            if (!action.ticker) {
              setError("No ticker specified");
              setHudState("error");
              speak("Which ticker do you want to enter?");
              return;
            }

            // Check if ticker is in watchlist
            const ticker = watchlist.find((t) => t.symbol === action.ticker);
            if (!ticker) {
              // Prompt user to add to watchlist
              setPendingTickerAdd({ symbol: action.ticker, action });
              setHudState("confirming");
              speak(`${action.ticker} is not in your watchlist. Add it? Say yes to add.`);
              return; // Wait for confirmation
            }

            // Generate smart entry alert to find best contract
            speak("Searching for best contract");
            const entryAlert = await generateEntryAlert(
              action.ticker,
              action.price,
              action.optionType
            );

            if (!entryAlert || !entryAlert.alert.contract) {
              setError(`No suitable contracts found for ${action.ticker}`);
              setHudState("error");
              speak(`No suitable contracts found for ${action.ticker}`);
              return;
            }

            // Load contract through trade state machine
            if (onLoadContract) {
              // Combine reasoning with extracted context
              const fullReasoning = action.extractedContext
                ? `${entryAlert.reasoning} - ${action.extractedContext}`
                : entryAlert.reasoning;
              onLoadContract(entryAlert.alert.contract, ticker, fullReasoning);
              speak(`Loaded ${entryAlert.reasoning}. Review and send alert.`);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 2000);
            }
            break;
          }

          case "trim-trade": {
            const trade = action.ticker
              ? activeTrades.find((t) => t.ticker === action.ticker)
              : currentTrade;

            if (!trade) {
              setError("No active trade found");
              setHudState("error");
              speak("No active trade to trim");
              return;
            }

            // Use trade state machine to open alert composer
            if (onTrimTrade) {
              onTrimTrade();
              speak(`Opening trim alert for ${trade.ticker}. Review and send.`);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 2000);
            }
            break;
          }

          case "update-sl": {
            const trade = action.ticker
              ? activeTrades.find((t) => t.ticker === action.ticker)
              : currentTrade;

            if (!trade) {
              setError("No active trade found");
              setHudState("error");
              speak("No active trade to update");
              return;
            }

            // Use trade state machine to open alert composer
            if (onUpdateSL) {
              onUpdateSL();
              speak(`Opening stop loss update for ${trade.ticker}. Review and send.`);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 2000);
            }
            break;
          }

          case "exit-trade": {
            const trade = action.ticker
              ? activeTrades.find((t) => t.ticker === action.ticker)
              : currentTrade;

            if (!trade) {
              setError("No active trade found");
              setHudState("error");
              speak("No active trade to exit");
              return;
            }

            // Use trade state machine to open alert composer
            if (onExitTrade) {
              onExitTrade();
              speak(`Opening exit alert for ${trade.ticker}. Review and send.`);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 2000);
            }
            break;
          }

          case "add-position": {
            if (!currentTrade) {
              setError("No active trade found");
              setHudState("error");
              speak("No active trade to add to");
              return;
            }

            // Use trade state machine to open alert composer
            if (onAddPosition) {
              onAddPosition();
              speak(`Opening add position alert for ${currentTrade.ticker}. Review and send.`);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 2000);
            }
            break;
          }

          case "compound": {
            if (!action.subActions || action.subActions.length === 0) {
              setError("Invalid compound command");
              setHudState("error");
              return;
            }

            setPendingCompoundActions(action.subActions);
            setCompoundActionIndex(0);
            speak(`Executing ${action.subActions.length} actions in sequence`);

            // Execute first action
            await executeAction(action.subActions[0], currentTranscript);
            break;
          }

          case "navigate": {
            if (action.destination && onNavigate) {
              const destName = action.destination === "live" ? "watchlist" : action.destination;
              speak(`Going to ${destName}`);
              onNavigate(action.destination);
              setHudState("success");
              setTimeout(() => {
                setHudState(null);
                setIsListening(false);
                setWaitingForWakeWord(true);
              }, 1000);
            }
            break;
          }
        }

        // Clear state after simple actions
        setHudState(null);
        setIsListening(false);
        setWaitingForWakeWord(true);
      } catch (error) {
        console.error("[v0] Voice command execution error:", error);
        setError("Failed to process command");
        setHudState("error");
      }
    },
    [
      watchlist,
      activeTrades,
      currentTrade,
      // transcript, // Removed to prevent infinite loop
      onAddTicker,
      onRemoveTicker,
      onLoadContract,
      onTrimTrade,
      onUpdateSL,
      onExitTrade,
      onAddPosition,
      onNavigate,
      speak,
      createVoiceCommand,
    ]
  );

  // Start listening (hybrid: Web Speech or Whisper)
  const startListening = useCallback(async () => {
    // Whisper mode: push-to-talk recording
    if (voiceEngine === "whisper") {
      setTranscript("");
      setError("");
      setCommand(null);
      await whisper.startRecording();
      return;
    }

    // Web Speech mode: continuous listening
    if (!recognitionRef.current) {
      setError("Speech recognition not available");
      return;
    }

    setIsListening(true);
    setHudState(waitingForWakeWord ? "listening" : "listening");
    setTranscript("");
    setError("");
    setCommand(null);

    try {
      recognitionRef.current.start();

      if (waitingForWakeWord) {
        speak("Say Hey Honey to activate");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "";
      if (errMsg.includes("already started")) {
        // Ignore - already listening
      } else {
        console.error("[v0] Speech recognition start error:", error);
        setError("Failed to start listening");
        setHudState("error");
      }
    }
  }, [voiceEngine, waitingForWakeWord, speak, whisper]);

  // Stop listening (hybrid: Web Speech or Whisper)
  const stopListening = useCallback(() => {
    // Whisper mode: stop recording
    if (voiceEngine === "whisper") {
      whisper.stopRecording();
      return;
    }

    // Web Speech mode: stop continuous listening
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("[v0] Speech recognition stop error:", err);
      }
    }

    setIsListening(false);
    setHudState(null);
    setTranscript("");
    setWaitingForWakeWord(true);
  }, [voiceEngine, whisper]);

  // Process voice input with wake word detection
  const processVoiceInput = useCallback(
    (text: string) => {
      setTranscript(text);

      // If awaiting trade selection, handle that first
      if (awaitingTradeSelection) {
        handleTradeSelectionResponse(text);
        return;
      }

      console.warn("[v0] processVoiceInput:", text);
      const action = parseVoiceCommand(text);
      console.warn("[v0] Parsed action:", action);

      // Track command
      trackCommand({
        userId: "voice-user",
        command: action.type,
        rawTranscript: text,
        parsedType: action.type,
        wasHandled: action.type !== "unknown",
      });

      // Handle wake word (optional - auto-activates on any command)
      if (action.type === "wake-word") {
        setWaitingForWakeWord(false);
        setHudState("listening");
        speak("Ready. What would you like to do?");
        return;
      }

      // Auto-activate on first command (no wake word required)
      if (waitingForWakeWord) {
        console.warn("[v0] Auto-activating on first command:", text);
        setWaitingForWakeWord(false);
        // Continue to process the command below
      }
      if (action.type === "unknown") {
        console.warn("[v0] Unknown command");
        setHudState("error");
        setError("Try: 'Enter SPY' or 'Trim current trade'");
        speak("Command not recognized");
        return;
      }

      setPendingAction(action);
      setHudState("processing");

      // Set timeout to prevent hanging (8 seconds)
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
      processingTimeoutRef.current = setTimeout(() => {
        console.error("[v0] Voice command processing timeout after 8 seconds");
        setHudState("error");
        const errorMsg =
          action.type === "compound"
            ? "Compound commands require manual completion. Complete each step, then say the next command."
            : "Command timed out. Please try again.";
        setError(errorMsg);
        speak(errorMsg);
        setTimeout(() => {
          setHudState(null);
          setError("");
          setPendingAction(null);
          setPendingCompoundActions([]);
          setCompoundActionIndex(0);
          setIsListening(false);
        }, 4000);
      }, 8000);

      // Execute action (async for smart alerts)
      console.warn("[v0] Executing action:", action);
      executeAction(action, text);
    },
    [
      parseVoiceCommand,
      executeAction,
      waitingForWakeWord,
      speak,
      awaitingTradeSelection,
      handleTradeSelectionResponse,
    ]
  );

  // Confirm action and send alert
  const confirmAction = useCallback(async () => {
    // Clear processing timeout since action is completing
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    // Handle ticker addition confirmation
    if (pendingTickerAdd && onAddTicker) {
      try {
        setHudState("processing");
        speak(`Adding ${pendingTickerAdd.symbol} to watchlist`);
        await onAddTicker(pendingTickerAdd.symbol);
        speak(`${pendingTickerAdd.symbol} added. Searching for contract.`);

        // Wait a moment for watchlist to update, then retry the original action
        setTimeout(() => {
          executeAction(pendingTickerAdd.action);
        }, 1000);

        setPendingTickerAdd(null);
        return;
      } catch (error) {
        console.error("[v0] Failed to add ticker:", error);
        setError("Failed to add ticker");
        setHudState("error");
        setPendingTickerAdd(null);
        return;
      }
    }

    if (pendingAlert && onSendAlert) {
      try {
        setHudState("processing");
        speak("Sending alert");
        await onSendAlert(pendingAlert);
        speak("Alert sent");
      } catch (error) {
        console.error("[v0] Failed to send alert:", error);
        setError("Failed to send alert");
        setHudState("error");
        return;
      }
    } else if (pendingAction && !pendingAlert) {
      // Execute non-alert actions
      await executeAction(pendingAction);
    }

    // Check for pending compound actions
    if (
      pendingCompoundActions.length > 0 &&
      compoundActionIndex < pendingCompoundActions.length - 1
    ) {
      const nextIndex = compoundActionIndex + 1;
      setCompoundActionIndex(nextIndex);
      const nextAction = pendingCompoundActions[nextIndex];

      speak(`Next action: ${nextAction.type.replace("-", " ")}`);
      setTimeout(() => {
        executeAction(nextAction);
      }, 1000);
      return;
    } else if (pendingCompoundActions.length > 0) {
      // All compound actions complete
      speak("All actions completed");
      setPendingCompoundActions([]);
      setCompoundActionIndex(0);
    }

    setHudState(null);
    setPendingAction(null);
    setPendingAlert(null);
    setPendingTickerAdd(null);
    setCommand(null);
    setTranscript("");
    setIsListening(false);
    setWaitingForWakeWord(true);
  }, [
    pendingAction,
    pendingAlert,
    pendingTickerAdd,
    pendingCompoundActions,
    compoundActionIndex,
    onSendAlert,
    onAddTicker,
    executeAction,
    speak,
  ]);

  // Cancel action
  const cancelAction = useCallback(() => {
    // Clear processing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    speak("Cancelled");
    setHudState(null);
    setPendingAction(null);
    setPendingAlert(null);
    setPendingTickerAdd(null);
    setPendingCompoundActions([]);
    setCompoundActionIndex(0);
    setAwaitingTradeSelection(null);
    setCommand(null);
    setTranscript("");
    setIsListening(false);
    setWaitingForWakeWord(true);
  }, [speak]);

  // Retry after error
  const retryAction = useCallback(() => {
    setHudState("listening");
    setError("");
    setTranscript("");
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("[v0] Speech recognition not supported in this browser");
      setError("Speech recognition not supported");
      return;
    }

    // Create recognition instance
    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening
    recognition.interimResults = true; // Get partial results
    recognition.lang = "en-US";

    // Handle results
    recognition.onresult = (event: unknown) => {
      const results = (
        event as {
          results: {
            length: number;
            [key: number]: { isFinal: boolean; [key: number]: { transcript: string } };
          };
        }
      ).results;
      const last = results.length - 1;
      const result = results[last];
      const transcript = result[0].transcript.trim().toLowerCase();

      console.warn("[v0] Voice onresult - transcript:", transcript, "isFinal:", result.isFinal);

      if (result.isFinal) {
        console.warn("[v0] Processing final transcript:", transcript);
        // Process immediately on final result
        processVoiceInput(transcript);
      } else {
        // Update interim transcript for UI display
        setTranscript(transcript);
      }
    };

    // Handle errors
    recognition.onerror = (event: { error: string }) => {
      console.error("[v0] Speech recognition error:", event.error);

      if (event.error === "not-allowed") {
        setError("Microphone permission denied");
        speak("Please allow microphone access");
      } else if (event.error === "no-speech") {
        // Restart listening
        if (isListening) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Ignore if already started
            }
          }, 100);
        }
      } else {
        setError(`Speech error: ${event.error}`);
      }
    };

    // Handle end
    recognition.onend = () => {
      console.warn("[v0] Speech recognition ended");

      // Restart if still listening
      if (isListening) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            // Ignore if already started
          }
        }, 100);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isListening, processVoiceInput, speak]);

  // Handle Whisper transcripts
  useEffect(() => {
    if (voiceEngine === "whisper" && whisper.transcript) {
      console.warn("[v0] Whisper transcript:", whisper.transcript);
      processVoiceInput(whisper.transcript);
      whisper.clearTranscript();
    }
  }, [voiceEngine, whisper.transcript, processVoiceInput, whisper]);

  // Update isListening state based on active engine
  useEffect(() => {
    if (voiceEngine === "whisper") {
      setIsListening(whisper.isRecording || whisper.isProcessing);
      if (whisper.isProcessing) {
        setHudState("processing");
      }
      if (whisper.error) {
        setError(whisper.error);
        setHudState("error");
      }
    }
  }, [voiceEngine, whisper.isRecording, whisper.isProcessing, whisper.error]);

  // Keyboard shortcut (M key)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        // Don't trigger if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }

        if (isListening) {
          stopListening();
        } else {
          startListening();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    hudState,
    transcript,
    command,
    error,
    pendingAlert,
    waitingForWakeWord,
    startListening,
    stopListening,
    processVoiceInput,
    confirmAction,
    cancelAction,
    retryAction,
  };
}
