import { Question } from '../../../types';
import { InterviewContext } from './types';

export class QuestionNavigator {
  /**
   * Retrieves the next question from the queue.
   * This modifies the context's question queue by removing the question.
   */
  getNextQuestion(context: InterviewContext): Question | null {
    if (context.pendingFollowUpQuestion) {
      const nextQ = context.pendingFollowUpQuestion;
      context.pendingFollowUpQuestion = undefined;
      return nextQ;
    }

    if (context.questionQueue.length === 0) {
      return null;
    }
    
    // Shift removes the first element from the array and returns it.
    const nextQ = context.questionQueue.shift();
    return nextQ || null;
  }

  /**
   * Queues a dynamically generated follow-up question.
   * Sets it as the pending follow-up.
   */
  queueFollowUp(question: Question, context: InterviewContext): void {
    context.pendingFollowUpQuestion = question;
  }

  /**
   * Checks if there are any remaining questions.
   */
  hasNextQuestion(context: InterviewContext): boolean {
    return !!context.pendingFollowUpQuestion || context.questionQueue.length > 0;
  }
}
