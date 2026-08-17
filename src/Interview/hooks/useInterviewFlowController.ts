import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { InterviewContext, InterviewEvent } from '../../Evaluation/pipeline/types';
import { InterviewFlowController } from '../../Evaluation/pipeline/InterviewFlowController';
import { QuestionNavigator } from '../../Evaluation/pipeline/QuestionNavigator';
import { FollowUpService } from '../../Evaluation/pipeline/FollowUpService';
import { EvaluationDispatcher } from '../../Evaluation/dispatch/EvaluationDispatcher';
import { Question, EvaluationResult, InterviewCompletionResult, InterviewCompletionState, CompletionViewModel } from '../../../types';

export enum InterviewState {
  IDLE = 'IDLE',
  PRE_FLIGHT = 'PRE_FLIGHT',
  LISTENING = 'LISTENING',
  PROCESSING_TRANSCRIPT = 'PROCESSING_TRANSCRIPT',
  EVALUATING = 'EVALUATING',
  GENERATING_FOLLOW_UP = 'GENERATING_FOLLOW_UP',
  PLAYING_AUDIO = 'PLAYING_AUDIO',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface InterviewFeatureFlags {
  enableFollowUpQuestions: boolean;
  enableProctoring: boolean;
  enableEvaluation: boolean;
  enableSpeechToText: boolean;
}

export const DEFAULT_INTERVIEW_FEATURES: InterviewFeatureFlags = {
  enableFollowUpQuestions: true,
  enableProctoring: true,
  enableEvaluation: true,
  enableSpeechToText: true
};

export function useInterviewFlowController(
  contextOrSessionId: InterviewContext | string | null,
  initialFeatures: Partial<InterviewFeatureFlags> = {}
) {
  const controllerRef = useRef<InterviewFlowController | null>(null);
  
  // Determine if we are using the legacy string or the new context
  const isLegacy = typeof contextOrSessionId === 'string' || contextOrSessionId === null;
  const contextRef = useRef<InterviewContext | null>(isLegacy ? null : contextOrSessionId as InterviewContext);
  
  const [state, setState] = useState<string>('INITIALIZING');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [error, setError] = useState<{ message: string, recoverable: boolean } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<EvaluationResult | null>(null);
  const [completionResult, setCompletionResult] = useState<InterviewCompletionResult | null>(null);
  const completionResultRef = useRef<InterviewCompletionResult | null>(null);
  const [processingElapsedMs, setProcessingElapsedMs] = useState(0);

  useEffect(() => {
    let timer: any;
    if (completionResult && 
        (completionResult.completionState === InterviewCompletionState.QUEUED || 
         completionResult.completionState === InterviewCompletionState.RUNNING)) {
       
       if (completionResult.startedAt) {
         timer = setInterval(() => {
            const started = new Date(completionResult.startedAt!).getTime();
            setProcessingElapsedMs(Date.now() - started);
         }, 1000);
       }
    }
    return () => clearInterval(timer);
  }, [completionResult]);

  // Legacy state shims
  const [features, setFeatures] = useState<InterviewFeatureFlags>({
    ...DEFAULT_INTERVIEW_FEATURES,
    ...initialFeatures
  });
  const [legacyState, setLegacyState] = useState<InterviewState>(InterviewState.IDLE);

  useEffect(() => {
    const isContextObject = contextOrSessionId && typeof contextOrSessionId !== 'string';
    if (isContextObject && !controllerRef.current) {
      contextRef.current = contextOrSessionId as InterviewContext;
      const navigator = new QuestionNavigator();
      const dispatcher = EvaluationDispatcher.getInstance();
      const followUpService = new FollowUpService();
      
      const controller = new InterviewFlowController(
        contextRef.current,
        navigator,
        dispatcher,
        followUpService
      );
      
      controllerRef.current = controller;

      controller.on('STATE_CHANGED', (payload: { from: string, to: string }) => {
        setState(payload.to);
        setIsEvaluating(payload.to === 'EVALUATING' || payload.to === 'DECIDING' || payload.to === 'FOLLOW_UP');
      });

      controller.on('QUESTION_CHANGED', (payload: { question: Question, isFollowUp: boolean }) => {
        setCurrentQuestion(payload.question);
        setError(null);
      });

      controller.on('ANSWER_EVALUATED', (payload: { result: EvaluationResult }) => {
        setLastEvaluation(payload.result);
      });

      controller.on('INTERVIEW_COMPLETED', (payload: { result: InterviewCompletionResult }) => {
        setIsCompleted(true);
        if (payload.result) {
          completionResultRef.current = payload.result;
          setCompletionResult(payload.result);
        }
      });

      controller.on('ERROR_OCCURRED', (payload: { message: string, recoverable: boolean }) => {
        setError(payload);
      });

      // Start the flow
      controller.start().catch(console.error);
    }
  }, [contextOrSessionId]);

  const submitTranscript = useCallback(async (transcript: string) => {
    if (controllerRef.current) {
      await controllerRef.current.submitTranscript(transcript);
    }
  }, []);

  // --- LEGACY SHIMS ---
  const transitionTo = useCallback((newState: InterviewState) => {
    setLegacyState(newState);
  }, []);

  const setIsProcessing = useCallback((val: boolean) => {
    setLegacyState(prev => {
      if (val) return InterviewState.PROCESSING_TRANSCRIPT;
      if (prev === InterviewState.PROCESSING_TRANSCRIPT) return InterviewState.IDLE;
      return prev;
    });
  }, []);
  
  const updateFeatures = useCallback((newFeatures: Partial<InterviewFeatureFlags>) => {
    setFeatures(prev => ({ ...prev, ...newFeatures }));
  }, []);

  const completionViewModel: CompletionViewModel | null = useMemo(() => {
    if (!completionResult) return null;
    let mode: "report" | "processing" | "failed" = "processing";
    if (completionResult.completionState === InterviewCompletionState.FAILED) mode = "failed";
    if (completionResult.completionState === InterviewCompletionState.COMPLETED) mode = "report";
    
    return {
      mode,
      report: completionResult.report,
      errorReason: completionResult.errorReason,
      processingElapsedMs
    };
  }, [completionResult, processingElapsedMs]);

  return {
    // New pipeline exports
    state: isLegacy ? legacyState : state,
    currentQuestion,
    error,
    isCompleted,
    isEvaluating,
    lastEvaluation,
    completionResult,
    completionResultRef,
    completionViewModel,
    submitTranscript,
    controller: controllerRef.current,

    // Legacy exports to prevent tsc breaking in DynamicInterviewScreen
    features,
    isProcessing: legacyState === InterviewState.PROCESSING_TRANSCRIPT,
    setIsProcessing,
    transitionTo,
    updateFeatures
  };
}
