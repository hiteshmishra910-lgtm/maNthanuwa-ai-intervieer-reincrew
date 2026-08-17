import { Question, EvaluationResult } from '../../../types';

export interface HistoryEntry {
  question: string;
  answer: string;
  ideal_answer: string;
  evaluation?: EvaluationResult;
  difficulty?: string;
  category?: string;
  questionData?: Question;
}

export class QuestionNavigator {
  private currentIndex: number = 0;

  constructor(
    private questions: Question[],
    private history: HistoryEntry[] = []
  ) {}

  getCurrentQuestion(): Question | null {
    if (this.currentIndex >= this.questions.length) return null;
    return this.questions[this.currentIndex];
  }

  hasNextQuestion(): boolean {
    return this.currentIndex < this.questions.length - 1;
  }

  moveToNextQuestion(): Question | null {
    if (this.hasNextQuestion()) {
      this.currentIndex++;
      return this.getCurrentQuestion();
    }
    return null;
  }

  getQuestions(): Question[] {
    return this.questions;
  }

  insertFollowUp(question: Question) {
    // Insert the follow up immediately after the current question
    this.questions.splice(this.currentIndex + 1, 0, question);
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  getHistory(): HistoryEntry[] {
    return this.history;
  }
  
  addHistoryEntry(entry: HistoryEntry) {
    this.history.push(entry);
  }
}
