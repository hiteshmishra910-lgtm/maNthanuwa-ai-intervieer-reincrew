export class Normalizer {
  static normalize(text: string): string {
    if (!text) return "";
    return text
      .toLowerCase()
      // Escapes removed for `/`, `^` and `*`: inside a character class all three are literal, so
      // the escapes had no effect on what this matched. `\-` is deliberately KEPT — it sits
      // between `=` and `_`, where an unescaped `-` would form the range `=` to `_` and silently
      // strip a much wider set of characters.
      .replace(/['".,/#!$%^&*;:{}=\-_`~()]/g, "")
      .trim();
  }
}
