export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class DomainPackValidator {
  public static validate(pack: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!pack || typeof pack !== 'object') {
      return { valid: false, errors: ['Domain pack must be an object'], warnings: [] };
    }

    if (!pack.domain || typeof pack.domain !== 'string') {
      errors.push('Missing or invalid "domain" field');
    }

    if (!pack.version || typeof pack.version !== 'string') {
      errors.push('Missing or invalid "version" field (expected semver string)');
    }

    if (!Array.isArray(pack.concepts)) {
      errors.push('Missing or invalid "concepts" array');
    } else {
      const seenIds = new Set<string>();
      pack.concepts.forEach((c: any, index: number) => {
        if (!c.id || typeof c.id !== 'string') {
          errors.push(`Concept at index ${index} missing valid "id"`);
        } else if (seenIds.has(c.id)) {
          errors.push(`Duplicate concept ID found: "${c.id}"`);
        } else {
          seenIds.add(c.id);
        }

        if (!Array.isArray(c.aliases) || c.aliases.length === 0) {
          warnings.push(`Concept "${c.id}" has no aliases defined`);
        }
      });
    }

    if (pack.rules !== undefined && pack.rules !== null) {
      if (!Array.isArray(pack.rules)) {
        errors.push('Missing or invalid "rules" array');
      } else {
        const seenRuleIds = new Set<string>();
        pack.rules.forEach((rule: any, index: number) => {
          if (!rule.id || typeof rule.id !== 'string') {
            errors.push(`Rule at index ${index} missing valid "id"`);
          } else if (seenRuleIds.has(rule.id)) {
            errors.push(`Duplicate rule ID found: "${rule.id}"`);
          } else {
            seenRuleIds.add(rule.id);
          }

          if (!Array.isArray(rule.triggerPhrases) || rule.triggerPhrases.length === 0) {
            errors.push(`Rule "${rule.id}" missing non-empty "triggerPhrases"`);
          }
          if (!Array.isArray(rule.expectedPhrases) || rule.expectedPhrases.length === 0) {
            errors.push(`Rule "${rule.id}" missing non-empty "expectedPhrases"`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
