/**
 * Browser-based Whisper Client using Transformers.js
 * Provides 100% client-side speech recognition with no API calls
 */

import { pipeline, AutomaticSpeechRecognitionPipeline } from "@xenova/transformers";

let whisperPipeline: AutomaticSpeechRecognitionPipeline | null = null;
let isInitializing = false;

/**
 * Initialize Whisper model (call on app start)
 * Downloads ~39MB on first run, cached in IndexedDB thereafter
 */
export async function initWhisper(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (whisperPipeline) {
    return whisperPipeline;
  }

  // Prevent multiple concurrent initializations
  if (isInitializing) {
    // Wait for initialization to complete
    while (!whisperPipeline && isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return whisperPipeline!;
  }

  try {
    isInitializing = true;
    console.warn("[v0] Loading Whisper model...");

    whisperPipeline = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en", // English-only for speed (39MB)
      {
        quantized: true, // 8-bit quantization for smaller size
        progress_callback: (progress: { status?: string; progress?: number }) => {
          if (progress.status === "downloading") {
            const percent = Math.round(progress.progress || 0);
            console.warn(`[v0] Downloading Whisper: ${percent}%`);
          } else if (progress.status === "done") {
            console.warn("[v0] Whisper model loaded successfully");
          }
        },
      }
    );

    console.warn("[v0] Whisper ready");
    return whisperPipeline;
  } catch (error) {
    console.error("[v0] Failed to load Whisper:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Transcribe audio blob to text
 * @param audioBlob - Audio from MediaRecorder (webm/opus or wav)
 * @returns Transcript string
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const pipeline = await initWhisper();

    // Convert blob to ArrayBuffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Whisper expects raw audio data (16kHz mono)
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Extract mono channel
    const audioData = audioBuffer.getChannelData(0);

    // Transcribe
    const result = await pipeline(audioData, {
      chunk_length_s: 30, // Process in 30s chunks (irrelevant for 5s clips)
      stride_length_s: 5, // Overlap for longer audio
      return_timestamps: false, // Don't need word-level timing
      language: "en", // Force English
      task: "transcribe", // vs 'translate'
    });

    return result.text.trim();
  } catch (error) {
    console.error("[v0] Transcription error:", error);
    throw error;
  }
}

/**
 * Check if Whisper is supported in current browser
 */
export function isWhisperSupported(): boolean {
  return typeof WebAssembly !== "undefined" && "Worker" in window && "indexedDB" in window;
}

/**
 * Get current loading status
 */
export function getWhisperStatus(): "not-loaded" | "loading" | "ready" {
  if (whisperPipeline) return "ready";
  if (isInitializing) return "loading";
  return "not-loaded";
}
