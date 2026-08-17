import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeSpeechText, logLowConfidenceSTT } from '../services/speechDictionary';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeakOptions {
  onEnd?: () => void;
  onBoundary?: () => void;
}

export type MicStatus = 'off' | 'listening' | 'processing' | 'reconnecting' | 'error';

export const useSpeech = (activeQuestionId?: string | number) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscriptState] = useState('');
  const [interimTranscript, setInterimTranscriptState] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>('off');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const shouldKeepListeningRef = useRef(false);
  const finalChunksRef = useRef<string[]>([]);
  const finalTranscriptRef = useRef('');
  // PHASE 12: the verbatim transcript, before speechDictionary rewrites it. normalizeSpeechText
  // substitutes words (e.g. "gate" -> "git" when git terms are present), and only the rewritten
  // text was retained. Since the rewritten text is what gets graded and shown, there was no
  // record of what the candidate actually said if a score were disputed.
  const rawFinalChunksRef = useRef<string[]>([]);
  const rawTranscriptRef = useRef('');
  const interimTranscriptStateRef = useRef('');

  const activeQuestionIdRef = useRef<string | number | undefined>(activeQuestionId);
  const recognitionSessionIdRef = useRef<string | null>(null);
  const isRecognitionRunningRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastRestartTimeRef = useRef<number>(0);
  const restartRetryCountRef = useRef<number>(0);
  const MAX_RESTARTS = 50;

  // 1. Check browser support on mount
  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognitionCtor);
  }, []);

  // 2. Keep activeQuestionIdRef synced
  useEffect(() => {
    activeQuestionIdRef.current = activeQuestionId;
  }, [activeQuestionId]);

  const cleanupRecognition = useCallback(() => {
    recognitionSessionIdRef.current = null;
    isRecognitionRunningRef.current = false;
    restartRetryCountRef.current = 0;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
        rec.abort();
      } catch (e) {
        // Ignore abort errors
      }
    }
  }, []);

  const updateDebouncedTranscript = useCallback((finalText: string, interimText: string) => {
    // Direct batching update to ensure real-time streaming feedback is NEVER blocked during continuous paragraph speech
    setTranscriptState(finalText);
    setInterimTranscriptState(interimText);
  }, []);

  // 3. Use a Ref for the start function to completely eliminate React stale closures
  const executeStartListening = useRef<(qId: string | number) => void>(() => {});
  
  executeStartListening.current = (qId: string | number) => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }
    if (isRecognitionRunningRef.current) {
      // If already running for the exact same session, do not duplicate.
      return;
    }

    cleanupRecognition();

    const currentSessionId = Math.random().toString(36).substring(2, 9);
    recognitionSessionIdRef.current = currentSessionId;
    isRecognitionRunningRef.current = true;
    shouldKeepListeningRef.current = true;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-IN';

    // --- BULLETPROOF ONRESULT HANDLER ---
    recognition.onresult = (event: any) => {
      if (currentSessionId !== recognitionSessionIdRef.current) return;

      restartRetryCountRef.current = 0;
      setMicStatus('listening');

      let currentInterim = '';
      let newFinal = '';
      let newRawFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result[0]) continue;

        const rawText = result[0].transcript.trim();
        const confidence = result[0].confidence;

        if (result.isFinal) {
          // Chrome Web Speech API frequently returns confidence = 0 or missing confidence on long answers.
          // Only discard if raw text is completely empty.
          if (!rawText) {
            continue;
          }

          const normalized = normalizeSpeechText(rawText);

          if (confidence !== undefined && confidence >= 0.05 && confidence < 0.6) {
            logLowConfidenceSTT(rawText, normalized, confidence, activeQuestionIdRef.current);
          }

          if (normalized) {
            newFinal += normalized + ' ';
            newRawFinal += rawText + ' ';
          }
        } else {
          currentInterim += rawText + ' ';
        }
      }

      if (newFinal) {
        const trimmedNewFinal = newFinal.trim();
        finalChunksRef.current.push(trimmedNewFinal);
        finalTranscriptRef.current = finalChunksRef.current.join(' ').trim();
        // Keep the raw chunks index-aligned with the normalized ones.
        rawFinalChunksRef.current.push(newRawFinal.trim());
        rawTranscriptRef.current = rawFinalChunksRef.current.join(' ').trim();
      }
      
      interimTranscriptStateRef.current = currentInterim.trim();
      updateDebouncedTranscript(finalTranscriptRef.current, interimTranscriptStateRef.current);
    };

    recognition.onerror = (event: any) => {
      if (currentSessionId !== recognitionSessionIdRef.current) return;

      const errType = event?.error;

      // 'no-speech' is triggered by Chrome when the candidate pauses/remains silent.
      // It is a normal lifecycle event, not an error. Quietly allow onend to auto-restart.
      if (errType === 'no-speech' || errType === 'aborted') {
        isRecognitionRunningRef.current = false;
        return;
      }

      if (errType === 'not-allowed' || errType === 'service-not-allowed') {
        console.error(`[STT-ERROR] Microphone permission denied:`, errType);
        shouldKeepListeningRef.current = false;
        setIsListening(false);
        setMicStatus('error');
        isRecognitionRunningRef.current = false;
        return;
      }

      if (errType === 'network') {
        console.warn(`[STT-WARN] Brief speech recognition network glitch. Auto-reconnecting...`);
        setMicStatus('reconnecting');
        isRecognitionRunningRef.current = false;
        return;
      }

      console.warn(`[STT-WARN] Speech Recognition event: ${errType}. Auto-reconnecting...`);
      setMicStatus('reconnecting');
    };

    recognition.onend = () => {
      // Guard against stale async onend callbacks from previous recognition instances
      if (currentSessionId !== recognitionSessionIdRef.current) return;

      isRecognitionRunningRef.current = false;

      if (shouldKeepListeningRef.current) {
        const now = Date.now();
        const timeSinceLastRestart = now - lastRestartTimeRef.current;

        if (timeSinceLastRestart < 500) {
          restartRetryCountRef.current += 1;
        } else {
          restartRetryCountRef.current = 1;
        }

        lastRestartTimeRef.current = now;

        if (restartRetryCountRef.current > MAX_RESTARTS) {
          console.error("[STT-ERROR] Restart storm blocked. Stopping microphone.");
          shouldKeepListeningRef.current = false;
          setIsListening(false);
          setMicStatus('error');
          return;
        }

        // Fast restart for continuous speech without long gaps
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const restartDelay = isMobile
          ? (timeSinceLastRestart < 500 ? 1000 : 250)
          : (timeSinceLastRestart < 500 ? 300 : 30);

        setMicStatus('reconnecting');

        restartTimeoutRef.current = setTimeout(() => {
          if (shouldKeepListeningRef.current && currentSessionId === recognitionSessionIdRef.current) {
            try {
              const currentQId = activeQuestionIdRef.current || qId;
              if (currentQId) {
                executeStartListening.current(currentQId);
              } else {
                shouldKeepListeningRef.current = false;
                setIsListening(false);
                setMicStatus('off');
              }
            } catch (e) {
              console.error("[STT-ERROR] Failed to restart speech recognition:", e);
              setMicStatus('error');
              setIsListening(false);
            }
          }
        }, restartDelay);
      } else {
        setIsListening(false);
        setMicStatus('off');
      }
    };

    recognitionRef.current = recognition;
    
    try {
      setTimeout(() => {
        if (recognitionRef.current === recognition) {
          recognition.start();
          setIsListening(true);
          setMicStatus('listening');
        }
      }, 50);
    } catch (e) {
      console.error("[STT-ERROR] Error starting SpeechRecognition instance:", e);
      isRecognitionRunningRef.current = false;
      setMicStatus('error');
      setIsListening(false);
    }
  };

  // 4. Sync activeQuestionId changes: force cleanup and reset
  useEffect(() => {
    cleanupRecognition();
    restartRetryCountRef.current = 0;
    finalChunksRef.current = [];
    finalTranscriptRef.current = '';
    rawFinalChunksRef.current = [];
    rawTranscriptRef.current = '';
    interimTranscriptStateRef.current = '';

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setTranscriptState('');
    setInterimTranscriptState('');

    shouldKeepListeningRef.current = false;
    setIsListening(false);
    setMicStatus('off');
  }, [activeQuestionId, cleanupRecognition]);

  // 5. Continuous speech session rotation (prevents Chrome / Safari 60s hard cutoff)
  useEffect(() => {
    if (!isListening) return;

    const intervalId = setInterval(() => {
      if (recognitionRef.current && shouldKeepListeningRef.current && isRecognitionRunningRef.current) {
        try {
          recognitionRef.current.stop(); // Triggers onend, which seamlessly restarts
        } catch (e) {
          // Ignore rotation stop errors
        }
      }
    }, 25000);

    return () => clearInterval(intervalId);
  }, [isListening]);

  // 6. Visibility Change recovery listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && shouldKeepListeningRef.current) {
        if (micStatus === 'reconnecting' || micStatus === 'off' || micStatus === 'error') {
          const activeQId = activeQuestionIdRef.current;
          if (activeQId) {
            cleanupRecognition();
            restartTimeoutRef.current = setTimeout(() => {
              if (shouldKeepListeningRef.current && activeQId === activeQuestionIdRef.current) {
                executeStartListening.current(activeQId);
              }
            }, 300);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [micStatus, cleanupRecognition]);

  // 7. Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  // 8. Public Methods
  const startListening = useCallback((qId?: string | number) => {
    const targetQId = qId || activeQuestionIdRef.current;
    if (!targetQId) {
      console.warn("[STT-WARN] Cannot start listening without an active question ID.");
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    executeStartListening.current(targetQId);
  }, []);

  const stopListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    cleanupRecognition();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setTranscriptState(finalTranscriptRef.current);
    setInterimTranscriptState('');

    setIsListening(false);
    setMicStatus('off');
  }, [cleanupRecognition]);

  const resetTranscript = useCallback(() => {
    finalChunksRef.current = [];
    finalTranscriptRef.current = '';
    rawFinalChunksRef.current = [];
    rawTranscriptRef.current = '';
    interimTranscriptStateRef.current = '';

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setTranscriptState('');
    setInterimTranscriptState('');

    shouldKeepListeningRef.current = false;
    cleanupRecognition();
    setIsListening(false);
    setMicStatus('off');
  }, [cleanupRecognition]);

  // ADDED BACK: setTranscript for manual edits from parent components
  const setTranscript = useCallback((newVal: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setTranscriptState(newVal);
    setInterimTranscriptState('');
    finalChunksRef.current = newVal ? [newVal] : [];
    finalTranscriptRef.current = newVal;
    rawFinalChunksRef.current = newVal ? [newVal] : [];
    rawTranscriptRef.current = newVal;
    interimTranscriptStateRef.current = '';
  }, []);

  const speak = useCallback((text: string, options?: SpeakOptions | (() => void)) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtteranceRef.current = utterance;

      const onEnd = typeof options === 'function' ? options : options?.onEnd;
      const onBoundary = typeof options === 'object' ? options?.onBoundary : undefined;

      let selectedVoice: SpeechSynthesisVoice | undefined;
      const googleVoices = availableVoices.filter(v => v.name.includes('Google'));
      
      if (googleVoices.length > 0) {
        selectedVoice = googleVoices.find(v => v.name === 'Google US English') || googleVoices[0];
      } else {
        const premiumVoices = availableVoices.filter(v =>
          ['Natural', 'Premium', 'Online', 'Neural'].some(k => v.name.includes(k))
        );
        selectedVoice = premiumVoices.length > 0 ? premiumVoices[0] : availableVoices.filter(v => !v.name.includes('Desktop'))[0] || availableVoices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onboundary = () => { if (onBoundary) onBoundary(); };

      const handleEnd = () => {
        if (currentUtteranceRef.current === utterance) {
          setIsSpeaking(false);
          currentUtteranceRef.current = null;
          if (onEnd) onEnd();
        }
      };

      utterance.onend = handleEnd;
      utterance.onerror = (event: any) => {
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          console.error(`TTS Error: ${event.error}`);
        }
        handleEnd();
      };

      window.speechSynthesis.speak(utterance);

      const timeoutDuration = (text.length * 200) + 3000;
      setTimeout(() => {
        if (currentUtteranceRef.current === utterance && window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          handleEnd();
        }
      }, timeoutDuration);

    } else {
      console.warn("TTS not supported");
      const onEnd = typeof options === 'function' ? options : options?.onEnd;
      if (onEnd) onEnd();
    }
  }, [availableVoices]);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
    }
  }, []);

  const abortListening = useCallback(() => {
    shouldKeepListeningRef.current = false;
    cleanupRecognition();
    setIsListening(false);
    setMicStatus('off');
  }, [cleanupRecognition]);

  const warmUp = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('');
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Computed live stream combining committed final transcript and actively spoken interim text
  const liveTranscript = transcript + (interimTranscript ? (transcript.length > 0 && !transcript.endsWith(' ') ? ' ' : '') + interimTranscript : '');

  // 9. Return all expected functions and reactive transcripts
  return {
    isListening,
    transcript,
    interimTranscript,
    liveTranscript,
    setTranscript,
    resetTranscript,
    startListening,
    stopListening,
    abortListening,
    isSupported,
    speak,
    stopSpeaking,
    isSpeaking,
    warmUp,
    micStatus,
    /** Verbatim transcript before speechDictionary substitutions (PHASE 12). */
    getRawTranscript: () => rawTranscriptRef.current,
  };
};