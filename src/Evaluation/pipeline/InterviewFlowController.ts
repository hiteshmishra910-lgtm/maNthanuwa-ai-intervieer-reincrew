import { 
  InterviewContext, 
  InterviewEvent,
  FollowUpDecision
} from './types';
import { QuestionNavigator } from './QuestionNavigator';
import { FollowUpService } from './FollowUpService';
import { EvaluationDispatcher } from '../dispatch/EvaluationDispatcher';
import { InterviewCompletionState } from '../../../types';
import { EvaluationContext } from '../types/EvaluationContext';
import { AIService } from '../../Core/ai/aiService';

type Listener = (payload: any) => void;

class SimpleEventEmitter {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, listener: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== listener);
  }

  emit(event: string, payload?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(l => l(payload));
  }
}

export class InterviewFlowController {
  private emitter = new SimpleEventEmitter();
  public state: string = 'INITIALIZING';

  constructor(
    private context: InterviewContext,
    private navigator: QuestionNavigator,
    private dispatcher: EvaluationDispatcher,
    private followUpService: FollowUpService
  ) {
    // We defer initialization so the caller can attach event listeners first
  }

  public async start(): Promise<void> {
    try {
      // Initialization logic removed from strategy.
      
      const nextQ = this.navigator.getNextQuestion(this.context);
      if (nextQ) {
        this.context.currentQuestion = nextQ;
        this.transitionTo('QUESTION_READY');
        this.emit({ type: 'QUESTION_CHANGED', payload: { question: nextQ, isFollowUp: false } });
      } else {
        throw new Error("No questions available");
      }
    } catch (e: any) {
      this.handleError(e.message, false);
    }
  }

  on(event: string, listener: (payload: any) => void) {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (payload: any) => void) {
    this.emitter.off(event, listener);
  }

  private emit(event: InterviewEvent) {
    this.emitter.emit(event.type, event.payload);
  }

  private transitionTo(newState: string) {
    const oldState = this.state;
    this.state = newState;
    this.emitter.emit('STATE_CHANGED', { from: oldState, to: newState });
  }

  public async submitTranscript(transcript: string): Promise<void> {
    if (this.state !== 'QUESTION_READY' && this.state !== 'ERROR') {
      console.warn(`Cannot submit transcript from state ${this.state}`);
      return;
    }

    if (!transcript || transcript.trim().length === 0) {
      // STT Empty - graceful handling without penalty
      this.transitionTo('QUESTION_READY');
      this.emit({ type: 'ERROR_OCCURRED', payload: { message: "We didn't catch that, please try again.", recoverable: true } });
      return;
    }

    this.transitionTo('EVALUATING');

    try {
      const evalContext: EvaluationContext = {
        session: { id: this.context.metadata?.sessionId || 'temp', mode: this.context.mode },
        candidate: {
          name: this.context.candidate.name,
          email: this.context.candidate.email,
          role: this.context.candidate.role || 'Unknown'
        },
        question: this.context.currentQuestion!,
        response: transcript,
        evaluationProfile: this.context.configuration?.profile || { id: 'default', version_number: 1 } as any,
        metadata: { visualMetrics: this.context.metadata?.visualMetrics, settings: this.context.configuration }
      };

      const result = await this.dispatcher.evaluateQuestion(evalContext);
      
      this.context.answerHistory.push({
        questionId: this.context.currentQuestion!.id,
        questionText: this.context.currentQuestion!.question || (this.context.currentQuestion as any).text || "Unknown Question",
        transcript: transcript,
        evaluation: result,
        isFollowUp: !!this.context.currentQuestion?.isFollowUp
      });

      this.emit({ type: 'ANSWER_EVALUATED', payload: { result } });
      this.transitionTo('DECIDING');
      await this.decideNextStep(result);

    } catch (e: any) {
      // LLM/API Failure
      this.handleError(e.message || "Evaluation failed", true); 
      throw e;
    }
  }

  private async decideNextStep(result: any) {
    const decision = this.followUpService.evaluateNeedForFollowUp(result, this.context);

    if (decision.requiresFollowUp) {
      this.transitionTo('FOLLOW_UP');
      let followUpQ: any = null;
      
      const missingConcepts = decision.missingConcepts || [];
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      try {
        const lastTranscript = this.context.answerHistory.length > 0 
          ? this.context.answerHistory[this.context.answerHistory.length - 1].transcript 
          : '';
        
        followUpQ = await AIService.generateFollowUpQuestion(
          this.context.currentQuestion!, 
          lastTranscript, 
          missingConcepts, 
          controller.signal
        );
      } catch (e: any) {
        console.warn("Follow-up generation failed, falling back to deterministic template.", e);
        followUpQ = {
          id: `followup_${this.context.currentQuestion!.id}_fallback_${Date.now()}`,
          question: missingConcepts.length > 0 
            ? `You provided a good overview. Could you elaborate specifically on how ${missingConcepts[0]} fits into this?`
            : "Could you go into a bit more technical depth on the core mechanism behind your answer?",
          category: this.context.currentQuestion!.category,
          type: this.context.currentQuestion!.type,
          difficulty: this.context.currentQuestion!.difficulty,
          evaluationGuide: missingConcepts,
          isFollowUp: true,
          metadata: {
            generatedBy: 'System',
            generatedAt: new Date().toISOString(),
            fallbackUsed: true,
            reason: 'LLM Timeout or Failure'
          }
        };
      } finally {
        clearTimeout(timeoutId);
      }

      if (followUpQ) {
        followUpQ.isFollowUp = true;
        
        // Track the follow up
        if (!this.context.sessionMetrics) {
          this.context.sessionMetrics = { followUpsAsked: 0 };
        }
        this.context.sessionMetrics.followUpsAsked++;

        this.navigator.queueFollowUp(followUpQ, this.context);
        const nextQ = this.navigator.getNextQuestion(this.context);
        if (nextQ) {
          this.context.currentQuestion = nextQ;
          this.transitionTo('QUESTION_READY');
          this.emit({ type: 'FOLLOWUP_CREATED', payload: { question: nextQ } });
          this.emit({ type: 'QUESTION_CHANGED', payload: { question: nextQ, isFollowUp: true } });
          return;
        }
      }
    }

    // Normal progression if no follow up is needed or follow up generation failed
    const nextQ = this.navigator.getNextQuestion(this.context);
    if (nextQ) {
      this.context.currentQuestion = nextQ;
      this.transitionTo('QUESTION_READY');
      this.emit({ type: 'QUESTION_CHANGED', payload: { question: nextQ, isFollowUp: false } });
    } else {
      this.transitionTo('COMPLETED');
      await this.completeInterview();
    }
  }

  public completionResult: any = null;

  private async completeInterview() {
    try {
      const sessionId = this.context.metadata?.sessionId || 'temp';
      const result = await this.dispatcher.finalizeInterview(
        sessionId, 
        this.context.answerHistory, 
        this.context.proctoringSummary, 
        this.context.mode
      );
      this.completionResult = result;
      this.emit({ type: 'INTERVIEW_COMPLETED', payload: { result } });
    } catch (e: any) {
      console.error("Report generation failed", e);
      // Construct a generic error state
      const failResult = { completionState: InterviewCompletionState.FAILED, errorReason: e.message || 'Report generation failed' };
      this.completionResult = failResult;
      this.emit({ type: 'INTERVIEW_COMPLETED', payload: { result: failResult } });
    }
  }

  public handleError(message: string, recoverable: boolean) {
    this.transitionTo('ERROR');
    this.emit({ type: 'ERROR_OCCURRED', payload: { message, recoverable } });
  }

  public getContext(): Readonly<InterviewContext> {
    return this.context;
  }
}
