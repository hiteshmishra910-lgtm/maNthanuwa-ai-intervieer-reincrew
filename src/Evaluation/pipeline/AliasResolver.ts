import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Normalizer } from './Normalizer';
import { Tokenizer } from './Tokenizer';
import { Stemmer } from './Stemmer';

export interface CompiledAlias {
  readonly conceptId: string;
  readonly original: string;
  readonly stemmedJoined: string;
}

export class AliasResolver {
  private static compiledAliases: CompiledAlias[] = [];

  public static compileRegistry(force: boolean = false): void {
    if (!force && AliasResolver.compiledAliases.length > 0 && Object.keys(CONCEPT_REGISTRY).length <= new Set(AliasResolver.compiledAliases.map(a => a.conceptId)).size) return;

    const compiled: CompiledAlias[] = [];
    for (const [id, entry] of Object.entries(CONCEPT_REGISTRY)) {
      // Add canonical concept name as alias
      const canonicalNormalized = Normalizer.normalize(entry.concept);
      const canonicalTokens = Tokenizer.tokenize(canonicalNormalized);
      const canonicalStemmed = canonicalTokens.map(t => Stemmer.stem(t)).join(" ");
      
      compiled.push({
        conceptId: id,
        original: entry.concept,
        stemmedJoined: canonicalStemmed
      });

      // Add other aliases
      if (entry.aliases) {
        entry.aliases.forEach(alias => {
          const normalized = Normalizer.normalize(alias);
          const tokens = Tokenizer.tokenize(normalized);
          const stemmed = tokens.map(t => Stemmer.stem(t)).join(" ");
          
          compiled.push({
            conceptId: id,
            original: alias,
            stemmedJoined: stemmed
          });
        });
      }
    }

    AliasResolver.compiledAliases = compiled;
  }

  public static getCompiledAliases(): CompiledAlias[] {
    AliasResolver.compileRegistry();
    return AliasResolver.compiledAliases;
  }

  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Find all concepts present in the text and return matched alias info
  public static resolve(stemmedJoinedAnswer: string): Map<string, string[]> {
    AliasResolver.compileRegistry();

    const matches = new Map<string, string[]>(); // conceptId -> matched original aliases

    for (const alias of AliasResolver.compiledAliases) {
      if (alias.stemmedJoined) {
        const escaped = AliasResolver.escapeRegExp(alias.stemmedJoined);
        const regex = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
        if (regex.test(stemmedJoinedAnswer)) {
          if (!matches.has(alias.conceptId)) {
            matches.set(alias.conceptId, []);
          }
          matches.get(alias.conceptId)!.push(alias.original);
        }
      }
    }

    return matches;
  }
}
