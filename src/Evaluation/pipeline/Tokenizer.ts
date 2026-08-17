export class Tokenizer {
  static tokenize(text: string): string[] {
    if (!text) return [];
    return text
      // `-` is class-final here, where it is already literal, so the escape was inert.
      .split(/[^a-zA-Z0-9_-]+/)
      .filter(Boolean);
  }

  static applyNegationScope(tokens: string[]): string[] {
    const negationWords = new Set(['not', 'never', 'doesnt', 'dont', 'isnt', 'arent', 'cant', 'cannot', 'wouldnt', 'shouldnt', 'wont']);
    const conjunctions = new Set(['and', 'but', 'or', 'because', 'however', 'although', 'except', 'unless']);
    
    const result: string[] = [];
    let negationCounter = 0;

    for (const token of tokens) {
      const lowerToken = token.toLowerCase();
      
      if (negationWords.has(lowerToken)) {
        negationCounter = 5; // Apply to next 5 tokens max
        result.push(token); // Keep the negation word itself just in case
      } else if (conjunctions.has(lowerToken)) {
        negationCounter = 0; // Stop negation scope on conjunctions
        result.push(token);
      } else if (negationCounter > 0) {
        result.push(`NOT_${token}`);
        negationCounter--;
      } else {
        result.push(token);
      }
    }
    return result;
  }
}
