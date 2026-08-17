export class Stemmer {
  static stem(token: string): string {
    if (!token) return "";
    let stemmed = token.toLowerCase();
    
    let prefix = "";
    if (stemmed.startsWith("not_")) {
      prefix = "not_";
      stemmed = stemmed.substring(4);
    }
    
    // Plural rules
    if (stemmed.endsWith("ies")) {
      stemmed = stemmed.slice(0, -3) + "y";
    } else if (stemmed.endsWith("es") && !stemmed.endsWith("aes") && !stemmed.endsWith("ees") && !stemmed.endsWith("oes")) {
      if (stemmed.endsWith("sses") || stemmed.endsWith("xes") || stemmed.endsWith("shes") || stemmed.endsWith("ches")) {
        stemmed = stemmed.slice(0, -2);
      } else {
        stemmed = stemmed.slice(0, -1);
      }
    } else if (stemmed.endsWith("s") && !stemmed.endsWith("us") && !stemmed.endsWith("is") && !stemmed.endsWith("as") && !stemmed.endsWith("os") && !stemmed.endsWith("ss")) {
      stemmed = stemmed.slice(0, -1);
    }

    // Common developer suffixes
    if (stemmed.endsWith("ing") && stemmed.length > 5) {
      stemmed = stemmed.slice(0, -3);
    } else if (stemmed.endsWith("ed") && stemmed.length > 4) {
      stemmed = stemmed.slice(0, -2);
    } else if (stemmed.endsWith("ly")) {
      stemmed = stemmed.slice(0, -2);
    }

    return prefix + stemmed;
  }
}
