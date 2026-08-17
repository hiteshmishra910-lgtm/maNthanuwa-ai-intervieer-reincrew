export class TranscriptValidator {
  /**
   * Validates a transcript using heuristics instead of relying on browser confidence scores.
   * Prevents submission of empty, noisy, or accidental recordings.
   */
  static validate(transcript: string): { isValid: boolean; reason?: string } {
    if (!transcript) {
      return { isValid: false, reason: "Empty transcript" };
    }
    
    const trimmed = transcript.trim();
    if (trimmed.length < 3) {
      return { isValid: false, reason: "Transcript too short" };
    }

    const words = trimmed.toLowerCase().split(/\s+/);
    
    // 1. Repetitive noise check (e.g., "hello hello hello")
    if (words.length > 5) {
      const uniqueWords = new Set(words);
      // If the vocabulary is extremely restricted relative to length
      if (uniqueWords.size < Math.max(3, words.length * 0.2)) {
        return { isValid: false, reason: "Repetitive noise detected" };
      }
    }
    
    // 2. Mic check / filler word filter
    const noisePhrases = new Set(["hello", "testing", "test", "mic", "check", "can", "you", "hear", "me", "uh", "um", "ah"]);
    if (words.length <= 6 && words.every(w => noisePhrases.has(w.replace(/[^a-z]/g, '')))) {
      return { isValid: false, reason: "Only noise words detected" };
    }

    return { isValid: true };
  }
}
