import { PipelineContext, EvaluationModule } from './interfaces';
import { FatalIssue, QuestionAlignment } from '../../../types';
import { CONCEPT_REGISTRY } from './ConceptRegistry';
import { Tokenizer } from './Tokenizer';
import { Normalizer } from './Normalizer';
import { Stemmer } from './Stemmer';

export class QuestionAlignmentEvaluator implements EvaluationModule {
  readonly name = 'QuestionAlignmentEvaluator';

  execute(context: PipelineContext): void {
    context.developerTrace.push('Starting QuestionAlignmentEvaluator...');

    const answerLower = context.answer.toLowerCase().trim();
    const questionText = (context.question.question || (context.question as any).text || "").toLowerCase();
    const stemmedJoined = context.stemmedTokens.join(' ');

    if (!answerLower || context.isHonestUnknown) {
      context.questionAlignment = {
        answeredQuestion: false,
        relevanceScore: 0,
        intentScore: 0,
        topicScore: 0,
        scenarioScore: 0,
        evidenceScore: 0,
        completenessScore: 0,
        misunderstandingDetected: false,
        offTopic: false,
        genericMemorizedAnswer: false,
        answeredDifferentQuestion: false,
        requiredElementsMissing: ['Answer is empty or honest unknown'],
        fatalIssues: [FatalIssue.DID_NOT_ANSWER],
        explanation: 'The candidate did not provide an answer or admitted not knowing the concept.'
      };
      context.developerTrace.push('QuestionAlignmentEvaluator completed: empty or honest unknown answer.');
      return;
    }

    // Determine the fine-grained question type/subtype
    const questionType = context.questionType;
    const isBehavioral = ['HR', 'Scenario', 'Conflict', 'Leadership', 'Decision Making', 'Experience', 'Behavioral'].includes(questionType) ||
      questionText.includes('tell me about a time') ||
      questionText.includes('describe a time') ||
      questionText.includes('describe a situation') ||
      questionText.includes('have you ever');

    // 1. Topic Score Calculation
    // Find expected concepts
    const expectedIds = new Set<string>();
    const expectedAliases = new Map<string, string[]>();
    
    if (context.question.rubric) {
      (context.question.rubric.coreConcepts || []).forEach((cId: string) => {
        expectedIds.add(cId);
        const registryAliases = CONCEPT_REGISTRY[cId]?.aliases || [];
        expectedAliases.set(cId, registryAliases.concat([cId]));
      });
      (context.question.rubric.supportingConcepts || []).forEach((cId: string) => {
        expectedIds.add(cId);
        const registryAliases = CONCEPT_REGISTRY[cId]?.aliases || [];
        expectedAliases.set(cId, registryAliases.concat([cId]));
      });
    }
    if (context.question.knowledgeModel) {
      context.question.knowledgeModel.forEach(c => {
        expectedIds.add(c.conceptId);
        const registryAliases = CONCEPT_REGISTRY[c.conceptId]?.aliases || [];
        expectedAliases.set(c.conceptId, registryAliases.concat([c.conceptId]));
      });
    } else if (context.question.keyConcepts) {
      context.question.keyConcepts.forEach((kc: any) => {
        const id = kc.id || kc.concept.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        expectedIds.add(id);
        const aliases = (kc.aliases || []).concat([kc.concept]);
        expectedAliases.set(id, aliases);
      });
    }

    let topicScore = 1.0;
    let matchedExpectedCount = 0;
    if (expectedIds.size > 0) {
      expectedIds.forEach(id => {
        let isMatched = context.matchedConcepts.has(id);
        if (!isMatched) {
          const aliases = expectedAliases.get(id) || [];
          const stemmedAliases = aliases.map(a => Tokenizer.tokenize(Normalizer.normalize(a)).map(t => Stemmer.stem(t)).join(' '));
          if (stemmedAliases.some(a => stemmedJoined.includes(a))) {
            isMatched = true;
            context.matchedConcepts.add(id);
          }
        }
        if (isMatched) {
          matchedExpectedCount++;
        }
      });
      topicScore = matchedExpectedCount / expectedIds.size;
    }

    // 2. Misunderstanding & Off-Topic / Answered Different Question detection
    let misunderstandingDetected = false;
    let offTopic = false;
    let answeredDifferentQuestion = false;
    const fatalIssues: FatalIssue[] = [];

    // Check if they discuss off-topic concepts extensively
    let outOfScopeConceptsMatched = 0;
    for (const [conceptId, entry] of Object.entries(CONCEPT_REGISTRY)) {
      if (expectedIds.has(conceptId)) continue;
      if (context.matchedConcepts.has(conceptId)) {
        outOfScopeConceptsMatched++;
      }
    }

    // If they explained 0 expected concepts, but explained multiple unrelated concepts, they probably answered a different question
    if (expectedIds.size > 0 && matchedExpectedCount === 0 && outOfScopeConceptsMatched >= 2) {
      answeredDifferentQuestion = true;
      misunderstandingDetected = true;
      fatalIssues.push(FatalIssue.ANSWERED_DIFFERENT_QUESTION);
    }

    // If relevance analyzer already marked low relevance or we matched absolutely no expected concepts
    if (expectedIds.size > 0 && matchedExpectedCount === 0 && context.relevantContentRatio < 0.2) {
      offTopic = true;
      fatalIssues.push(FatalIssue.OFF_TOPIC);
    }

    // 3. Scenario & Evidence Score (Behavioral / HR / Experience specific)
    let scenarioScore = 1.0;
    let evidenceScore = 1.0;
    const requiredElementsMissing: string[] = [];

    // Narrative pronouns check
    const personalPronouns = ['i', 'me', 'my', 'we', 'our', 'us'];
    const hasPersonalNarrative = personalPronouns.some(p => {
      const regex = new RegExp(`\\b${p}\\b`, 'i');
      return regex.test(answerLower);
    });

    const timeCues = ['when', 'last year', 'last semester', 'semester', 'previously', 'once', 'recently', 'in my', 'ago', 'during', 'project', 'team', 'at my previous', 'job', 'workplace', 'company', 'role'];
    const starCues = ['situation', 'task', 'action', 'result', 'resolved', 'impact', 'solved', 'fixed', 'challenge', 'outcome'];

    const hasTimeCues = timeCues.some(c => answerLower.includes(c));
    const hasStarCues = starCues.some(c => answerLower.includes(c));

    const categoryLower = String((context.question as any).interviewCategory || '').toLowerCase();
    const typeLower = String(context.question.type || (context.question as any).questionType || context.questionType || '').toLowerCase();
    const isIntroductory = categoryLower.includes('intro') || typeLower.includes('intro') || questionText.includes('tell me about') || questionText.includes('background') || (context.question.evaluationGuide && context.question.evaluationGuide.some((g: string) => g.toLowerCase().includes('tell me about')));

    let genericMemorizedAnswer = false;
    if (isBehavioral && !isIntroductory) {
      if (!hasPersonalNarrative) {
        scenarioScore = 0.1;
        evidenceScore = 0.1;
        requiredElementsMissing.push('personal_narrative');
        fatalIssues.push(FatalIssue.NO_EXAMPLE_PROVIDED);
      } else {
        // Compute scenario coverage based on STAR elements
        let starHits = 0;
        if (answerLower.includes('situation') || answerLower.includes('context') || answerLower.includes('project')) starHits++;
        if (answerLower.includes('task') || answerLower.includes('challenge') || answerLower.includes('problem')) starHits++;
        if (answerLower.includes('action') || answerLower.includes('implemented') || answerLower.includes('did') || answerLower.includes('resolved')) starHits++;
        if (answerLower.includes('result') || answerLower.includes('outcome') || answerLower.includes('impact')) starHits++;
        scenarioScore = Math.max(0.2, starHits / 4);
        evidenceScore = hasTimeCues ? 1.0 : 0.5;
        if (!hasTimeCues) {
          requiredElementsMissing.push('specific_timeline_context');
        }
      }

      // Check for generic definitions
      if (answerLower.includes('stands for') || answerLower.includes('is a framework') || answerLower.includes('refers to')) {
        // If they define the concept without personal pronouns, it's a generic memorized response
        if (!hasPersonalNarrative || (answerLower.includes('star method') && !answerLower.includes('i fixed') && !answerLower.includes('i resolved'))) {
          genericMemorizedAnswer = true;
          fatalIssues.push(FatalIssue.MEMORIZED_TEMPLATE);
        }
      }
    } else {
      // Technical questions don't require personal scenarios, but require technical details
      scenarioScore = 1.0;
      // Only penalize evidenceScore when there WERE expected concepts but none matched.
      // If expectedIds is empty (no knowledgeModel/keyConcepts), evidence defaults to 1.0 — 
      // we can't judge what we have no expectations for.
      if (expectedIds.size === 0) {
        evidenceScore = 1.0;
      } else {
        evidenceScore = (matchedExpectedCount > 0 || (context.matchedConcepts && context.matchedConcepts.size > 0)) ? 1.0 : 0.2;
      }
    }

    // 4. Intent Score Calculation
    // Verify did they satisfy "why", "how", "compare" intent of the question
    let intentScore = 1.0;
    if (context.questionSatisfaction === 'NO') {
      intentScore = 0.2;
    } else if (context.questionSatisfaction === 'PARTIAL') {
      intentScore = 0.6;
    }

    // 5. Completeness Score (coverage of knowledge model)
    const completenessScore = topicScore;

    // 6. Overall Relevance score
    let relevanceScore = (topicScore * 0.4) + (intentScore * 0.3) + (scenarioScore * 0.3);
    
    // Hard override if they answered a completely different question or are totally off-topic
    if (answeredDifferentQuestion || offTopic) {
      relevanceScore = Math.min(0.2, relevanceScore);
    }

    // Decide if they actually answered the question
    const answeredQuestion = relevanceScore >= 0.35 && !genericMemorizedAnswer && !offTopic && !answeredDifferentQuestion;

    if (!answeredQuestion && fatalIssues.length === 0) {
      fatalIssues.push(FatalIssue.DID_NOT_ANSWER);
    }

    // Compile explanation for the recruiter
    let explanation = 'The candidate answered the question successfully and stayed on topic.';
    if (answeredDifferentQuestion) {
      explanation = 'The candidate appeared to answer a completely different question, focusing on unrelated concepts.';
    } else if (genericMemorizedAnswer) {
      explanation = 'The candidate gave a generic definition or memorized template instead of describing a real scenario.';
    } else if (offTopic) {
      explanation = 'The candidate was off-topic, rambling into out-of-scope concepts.';
    } else if (!answeredQuestion) {
      explanation = 'The candidate did not sufficiently align with the question intent or lacked required details.';
    }

    context.questionAlignment = {
      answeredQuestion,
      relevanceScore: Math.round(relevanceScore * 100) / 100,
      intentScore: Math.round(intentScore * 100) / 100,
      topicScore: Math.round(topicScore * 100) / 100,
      scenarioScore: Math.round(scenarioScore * 100) / 100,
      evidenceScore: Math.round(evidenceScore * 100) / 100,
      completenessScore: Math.round(completenessScore * 100) / 100,
      misunderstandingDetected,
      offTopic,
      genericMemorizedAnswer,
      answeredDifferentQuestion,
      requiredElementsMissing,
      fatalIssues,
      explanation
    };

    context.developerTrace.push(`QuestionAlignmentEvaluator completed. answeredQuestion: ${answeredQuestion}, relevanceScore: ${relevanceScore}`);
  }
}
