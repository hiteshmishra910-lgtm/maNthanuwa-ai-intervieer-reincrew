import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudioLevel = (stream: MediaStream | null) => {
  const [level, setLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const startMonitoring = useCallback(() => {
    if (!stream) return;

    try {
      // 1. Setup Audio Context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      source.connect(analyser);
      analyser.fftSize = 256;
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // Normalized level 0-100ish
          setLevel(average);
          animationRef.current = requestAnimationFrame(update);
        }
      };

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      update();
    } catch (err) {
      console.error("Failed to start audio monitoring:", err);
    }
  }, [stream]);

  const stopMonitoring = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    if (stream) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
    return stopMonitoring;
  }, [stream, startMonitoring, stopMonitoring]);

  return level;
};
