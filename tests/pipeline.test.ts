import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InterviewFlowController } from '../src/Evaluation/pipeline/InterviewFlowController';
import { FollowUpService } from '../src/Evaluation/pipeline/FollowUpService';
import { QuestionNavigator } from '../src/Evaluation/pipeline/QuestionNavigator';
import { EvaluationMode } from '../types';

vi.mock('../src/Core/ai/aiService', () => ({
  AIService: {
    generateFollowUpQuestion: vi.fn().mockResolvedValue({ id: 'f1', question: 'Follow up?' })
  }
}));

describe('InterviewFlowController', () => {
  let mockContext: any;
  let mockNavigator: any;
  let mockStrategy: any;
  let mockFollowUpService: any;
  let controller: InterviewFlowController;

  beforeEach(() => {
    mockContext = {
      candidate: { name: 'Test', email: 'test@example.com', role: 'Dev' },
      job: { id: 'job-1', title: 'Developer', description: '' },
      mode: 'Local' as EvaluationMode,
      configuration: { enableFollowUpQuestions: true },
      questionQueue: [{ id: 'q1', question: 'Question 1' }, { id: 'q2', question: 'Question 2' }],
      currentQuestion: null,
      answerHistory: [],
      proctoringSummary: { warnings: 0, status: 'OK' },
      timers: { elapsedSeconds: 0 },
      metadata: {}
    };

    mockNavigator = new QuestionNavigator();
    
    mockStrategy = {
      evaluateQuestion: vi.fn().mockResolvedValue({ contentScore: 8, verdict: 'Pass' }),
      finalizeInterview: vi.fn().mockResolvedValue({})
    };

    mockFollowUpService = new FollowUpService();

    controller = new InterviewFlowController(
      mockContext,
      mockNavigator,
      mockStrategy,
      mockFollowUpService
    );
  });

  it('should initialize correctly and transition to QUESTION_READY', async () => {
    const onStateChanged = vi.fn();
    const onQuestionChanged = vi.fn();
    
    controller.on('STATE_CHANGED', onStateChanged);
    controller.on('QUESTION_CHANGED', onQuestionChanged);

    await controller.start();
    expect(controller.state).toBe('QUESTION_READY');
    expect(mockContext.currentQuestion?.id).toBe('q1');
    expect(onStateChanged).toHaveBeenCalledWith({ from: 'INITIALIZING', to: 'QUESTION_READY' });
    expect(onQuestionChanged).toHaveBeenCalledWith(expect.objectContaining({
      question: expect.objectContaining({ id: 'q1' }),
      isFollowUp: false
    }));
  });

  it('should handle evaluation and follow-up generation', async () => {
    await controller.start();
    
    // Force a condition that triggers a follow up
    mockStrategy.evaluateQuestion.mockResolvedValueOnce({
      missingKeyPoints: ['Missing something'],
      verdict: 'Pass',
      dimensions: {
        coverage: { score: 7 },
        correctness: { score: 8 }
      }
    });

    const onStateChanged = vi.fn();
    const onFollowUp = vi.fn();
    controller.on('STATE_CHANGED', onStateChanged);
    controller.on('FOLLOWUP_CREATED', onFollowUp);

    await controller.submitTranscript('This is my answer');

    expect(mockStrategy.evaluateQuestion).toHaveBeenCalledWith(expect.objectContaining({ response: 'This is my answer' }));
    expect(controller.state).toBe('QUESTION_READY');
    expect(mockContext.currentQuestion?.id).toBe('f1');
    expect(onFollowUp).toHaveBeenCalled();
  });
  
  it('should handle end of interview', async () => {
    await controller.start();
    
    // Clear queue so the next question is null
    mockContext.questionQueue = [];
    
    const onCompleted = vi.fn();
    controller.on('INTERVIEW_COMPLETED', onCompleted);
    
    await controller.submitTranscript('Last answer');
    
    expect(controller.state).toBe('COMPLETED');
    expect(mockStrategy.finalizeInterview).toHaveBeenCalled();
    expect(onCompleted).toHaveBeenCalled();
  });
});

describe('FollowUpService', () => {
  it('should not generate follow up if disabled in config', () => {
    const service = new FollowUpService();
    const result = service.evaluateNeedForFollowUp(
      { 
        contentScore: 5, 
        missingKeyPoints: ['A'], 
        dimensions: { coverage: { score: 7 }, correctness: { score: 6 } } 
      } as any,
      { configuration: { enableFollowUpQuestions: false }, currentQuestion: {} } as any
    );
    expect(result.requiresFollowUp).toBe(false);
  });

  it('should not generate follow up if already on a follow up question', () => {
    const service = new FollowUpService();
    const result = service.evaluateNeedForFollowUp(
      { 
        contentScore: 5, 
        missingKeyPoints: ['A'],
        dimensions: { coverage: { score: 7 }, correctness: { score: 6 } } 
      } as any,
      { configuration: { enableFollowUpQuestions: true }, currentQuestion: { isFollowUp: true } } as any
    );
    expect(result.requiresFollowUp).toBe(false);
  });

  it('should generate follow up for partial answers', () => {
    const service = new FollowUpService();
    const result = service.evaluateNeedForFollowUp(
      { 
        missingKeyPoints: ['A'],
        dimensions: { coverage: { score: 7 }, correctness: { score: 8 } } // Score must be >= 7 to trigger a follow-up now
      } as any,
      { configuration: { enableFollowUpQuestions: true }, currentQuestion: { isFollowUp: false } } as any
    );
    expect(result.requiresFollowUp).toBe(true);
  });
});
