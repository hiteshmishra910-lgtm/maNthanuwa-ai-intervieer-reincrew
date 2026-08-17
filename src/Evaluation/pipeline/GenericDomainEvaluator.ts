import { PipelineContext, EvaluationModule, DomainPack, Evidence } from './interfaces';
import { DomainPackValidator } from './DomainPackValidator';
import dbmsPack from '../domainPacks/DBMS.json';
import networksPack from '../domainPacks/Networks.json';
import osPack from '../domainPacks/OS.json';
import systemDesignPack from '../domainPacks/SystemDesign.json';

export class GenericDomainEvaluator implements EvaluationModule {
  readonly name = 'GenericDomainEvaluator';
  private domainPacks: Map<string, DomainPack> = new Map();

  constructor() {
    this.registerPack(dbmsPack as any);
    this.registerPack(networksPack as any);
    this.registerPack(osPack as any);
    this.registerPack(systemDesignPack as any);
  }

  public registerPack(rawPack: any) {
    const val = DomainPackValidator.validate(rawPack);
    if (!val.valid) {
      console.warn(`[GenericDomainEvaluator] Failed to register domain pack: ${val.errors.join(', ')}`);
      return;
    }
    this.domainPacks.set(rawPack.domain.toLowerCase(), rawPack as DomainPack);
  }

  execute(context: PipelineContext): void {
    if (!context.evidences) context.evidences = [];

    const textLower = context.normalizedAnswer.toLowerCase();

    // Check all registered domain packs
    this.domainPacks.forEach((pack, domainKey) => {
      pack.concepts.forEach(concept => {
        concept.aliases.forEach(alias => {
          const aliasLower = alias.toLowerCase();
          if (textLower.includes(aliasLower)) {
            // Compute similarity score (0.0 - 1.0)
            const similarityScore = textLower.includes(aliasLower) ? 0.95 : 0.70;

            context.matchedConcepts.add(concept.id);
            let comp = context.conceptCompleteness.get(concept.id);
            if (!comp) {
              comp = {
                satisfiedDimensions: ['definition', 'mechanism'],
                completenessRatio: 1.0
              };
              context.conceptCompleteness.set(concept.id, comp);
            } else {
              if (!comp.satisfiedDimensions.includes('definition')) comp.satisfiedDimensions.push('definition');
              if (!comp.satisfiedDimensions.includes('mechanism')) comp.satisfiedDimensions.push('mechanism');
            }
            context.conceptEvidence.push({
              conceptId: concept.id,
              matchedAlias: alias,
              sentenceIndex: 0,
              matchStrength: 'EXACT_ALIAS',
              confidence: 1.0
            });
            context.evidences!.push({
              id: `ev_dom_${domainKey}_${concept.id}`,
              type: 'concept',
              sentenceIndex: 0,
              span: alias,
              confidence: 0.9,
              similarityScore,
              conceptId: concept.id,
              source: `GenericDomainEvaluator:${domainKey}`
            });
          }
        });
      });

      // Misconception checking
      pack.misconceptions.forEach(misc => {
        misc.keywords.forEach(kw => {
          if (textLower.includes(kw.toLowerCase())) {
            context.technicalErrors.push({
              ruleId: `misc_${misc.id}`,
              matchedText: kw,
              expected: 'Correct technical principle',
              explanation: misc.explanation,
              severity: misc.severity === 'critical' ? 'high' : misc.severity === 'moderate' ? 'medium' : 'low',
              penalty: misc.severity === 'critical' ? 5.0 : misc.severity === 'moderate' ? 2.0 : 0.5
            });
          }
        });
      });
    });

    context.developerTrace.push(`GenericDomainEvaluator executed across ${this.domainPacks.size} domain packs.`);
  }
}
