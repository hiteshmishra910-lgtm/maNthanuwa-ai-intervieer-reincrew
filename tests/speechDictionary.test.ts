import { describe, it, expect } from 'vitest';
import { normalizeSpeechText, processTranscript } from '../src/Interview/services/speechDictionary';

describe('Speech Dictionary Context-Aware Replacements', () => {
  it('should preserve "logic gate" when context is electrical engineering', () => {
    const input = 'an AND logic gate produces true output';
    const output = normalizeSpeechText(input);
    expect(output).toBe('an AND logic gate produces true output');
  });

  it('should replace "gate repository" with "git repository" when repository context is present', () => {
    const input = 'I committed changes to the gate repository';
    const output = normalizeSpeechText(input);
    expect(output).toBe('I committed changes to the git repository');
  });

  it('should preserve rawTranscript and return cleanedTranscript in processTranscript', () => {
    const raw = 'an AND logic gate produces true output';
    const processed = processTranscript(raw);
    expect(processed.rawTranscript).toBe(raw);
    expect(processed.cleanedTranscript).toBe(raw);
  });

  it('should handle context-aware replacement for OOP words', () => {
    const input1 = 'oops I made a mistake';
    expect(normalizeSpeechText(input1)).toBe('oops I made a mistake');

    const input2 = 'oops class inheritance and encapsulation';
    expect(normalizeSpeechText(input2)).toBe('OOP class inheritance and encapsulation');
  });
});
