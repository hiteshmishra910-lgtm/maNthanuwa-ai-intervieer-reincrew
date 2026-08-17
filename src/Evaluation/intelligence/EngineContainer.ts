/**
 * EngineContainer.ts (Phase 3 & Phase 5 Dependency Injection Container)
 * Implements IEvaluationEngineContainer interface to expose IntentEngine,
 * EvidenceEngine, ReasoningEngine, DialogueContext, and AdaptiveProbeEngine to EvaluationCore.
 */

import { IEvaluationEngineContainer } from '../pipeline/sharedContracts';
import { IntentEngine } from './IntentEngine';
import { EvidenceEngine } from './EvidenceEngine';
import { ReasoningEngine } from './ReasoningEngine';
import { DialogueContext } from './DialogueContext';
import { AdaptiveProbeEngine } from './AdaptiveProbeEngine';

export class EngineContainer implements IEvaluationEngineContainer {
  public readonly schemaVersion = 'v1.0' as const;
  private static instance: EngineContainer;

  private intentEngine: IntentEngine;
  private evidenceEngine: EvidenceEngine;
  private reasoningEngine: ReasoningEngine;
  private probeEngine: AdaptiveProbeEngine;

  private constructor() {
    this.intentEngine = new IntentEngine();
    this.evidenceEngine = new EvidenceEngine();
    this.reasoningEngine = new ReasoningEngine();
    this.probeEngine = new AdaptiveProbeEngine();
  }

  public static getInstance(): EngineContainer {
    if (!EngineContainer.instance) {
      EngineContainer.instance = new EngineContainer();
    }
    return EngineContainer.instance;
  }

  public getIntentEngine(): IntentEngine {
    return this.intentEngine;
  }

  public getEvidenceEngine(): EvidenceEngine {
    return this.evidenceEngine;
  }

  public getReasoningEngine(): ReasoningEngine {
    return this.reasoningEngine;
  }

  public getDialogueContext(sessionId: string): DialogueContext {
    return new DialogueContext(sessionId);
  }

  public getProbeEngine(): AdaptiveProbeEngine {
    return this.probeEngine;
  }

  public getSemanticProvider(): null {
    return null;
  }
}
