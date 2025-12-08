import { useState, useCallback, useEffect, useRef } from "react";
import { VoiceHUDState, VoiceCommand } from "../components/hd/HDVoiceHUD";
import { Trade, Ticker, Contract } from "../types";
import { useSettingsStore } from "../stores/settingsStore";
import {
  generateEntryAlert,
  generateExitAlert,
  generateTrimAlert,
  generateStopLossAlert,
  SmartAlertResult,
} from "../lib/services/smartAlertService";
import { useWhisperVoice } from "./useWhisperVoice";
import { useUserSettings } from "./useUserSettings";

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
}

interface UseVoiceCommandsProps {
  watchlist: Ticker[];
  activeTrades: Trade[];
  currentTrade: Trade | null;
  onAddTicker?: (symbol: string) => void;
  onRemoveTicker?: (ticker: Ticker) => void;
  onLoadContract?: (contract: Contract) => void;
  onEnterTrade?: () => void;
  onTrimTrade?: () => void;
  onUpdateSL?: () => void;
  onExitTrade?: () => void;
  onAddPosition?: () => void;
  onSendAlert?: (alert: SmartAlertResult) => Promise<void>;
}

export function useVoiceCommands({
  watchlist,
  activeTrades,
  currentTrade,
  onAddTicker,
  onRemoveTicker,
  _onLoadContract,
  _onEnterTrade,
  _onTrimTrade,
  _onUpdateSL,
  _onExitTrade,
  onAddPosition,
  onSendAlert,
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
  const [waitingForWakeWord, setWaitingForWakeWord] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

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

    // Add ticker to watchlist
    if (lowerText.includes("add") && lowerText.includes("watchlist")) {
      return { type: "add-ticker", ticker };
    }

    // Remove ticker from watchlist
    if (lowerText.includes("remove") && lowerText.includes("watchlist")) {
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
      return {
        type: "enter-trade",
        ticker,
        price,
        optionType: isShort ? "P" : "C",
      };
    }

    // Trim position
    if (lowerText.includes("trim") || lowerText.includes("take profit")) {
      return { type: "trim-trade", ticker, trimPercent };
    }

    // Update stop loss
    if (lowerText.includes("update") && (lowerText.includes("stop") || lowerText.includes("sl"))) {
      return { type: "update-sl", ticker, price };
    }

    // Exit trade
    if (lowerText.includes("exit") || lowerText.includes("close")) {
      return { type: "exit-trade", ticker };
    }

    // Add to position
    if (lowerText.includes("add") && !lowerText.includes("watchlist")) {
      return { type: "add-position", ticker, price };
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

            // Generate smart entry alert
            speak("Searching for best contract");
            const entryAlert = await generateEntryAlert(
              action.ticker,
              action.price,
              action.optionType
            );

            if (!entryAlert) {
              setError(`No suitable contracts found for ${action.ticker}`);
              setHudState("error");
              speak(`No suitable contracts found for ${action.ticker}`);
              return;
            }

            setPendingAlert(entryAlert);
            const cmd = createVoiceCommand(action, currentTranscript, entryAlert);
            setCommand(cmd);
            setHudState("confirming");
            speak(`Found ${entryAlert.reasoning}. Send alert?`);
            return; // Wait for confirmation
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

            const trimAlert = generateTrimAlert(trade, action.trimPercent);
            setPendingAlert(trimAlert);
            const cmd = createVoiceCommand(action, currentTranscript, trimAlert);
            setCommand(cmd);
            setHudState("confirming");
            speak(`${trimAlert.reasoning}. Send alert?`);
            return; // Wait for confirmation
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

            const slAlert = generateStopLossAlert(trade, action.price);
            setPendingAlert(slAlert);
            const cmd = createVoiceCommand(action, currentTranscript, slAlert);
            setCommand(cmd);
            setHudState("confirming");
            speak(`${slAlert.reasoning}. Send alert?`);
            return; // Wait for confirmation
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

            const exitAlert = generateExitAlert(trade);
            setPendingAlert(exitAlert);
            const cmd = createVoiceCommand(action, currentTranscript, exitAlert);
            setCommand(cmd);
            setHudState("confirming");
            speak(`${exitAlert.reasoning}. Send alert?`);
            return; // Wait for confirmation
          }

          case "add-position":
            if (onAddPosition) {
              onAddPosition();
              speak("Adding to position");
            }
            break;
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
      onAddPosition,
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

      console.warn("[v0] processVoiceInput:", text);
      const action = parseVoiceCommand(text);
      console.warn("[v0] Parsed action:", action);

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

      // Execute action (async for smart alerts)
      console.warn("[v0] Executing action:", action);
      executeAction(action, text);
    },
    [parseVoiceCommand, executeAction, waitingForWakeWord, speak]
  );

  // Confirm action and send alert
  const confirmAction = useCallback(async () => {
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

    setHudState(null);
    setPendingAction(null);
    setPendingAlert(null);
    setCommand(null);
    setTranscript("");
    setIsListening(false);
    setWaitingForWakeWord(true);
  }, [pendingAction, pendingAlert, onSendAlert, executeAction, speak]);

  // Cancel action
  const cancelAction = useCallback(() => {
    speak("Cancelled");
    setHudState(null);
    setPendingAction(null);
    setPendingAlert(null);
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
