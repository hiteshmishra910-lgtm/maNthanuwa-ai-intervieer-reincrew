import { Question } from '../../../types';
import { EvaluationProfile } from '../pipeline/interfaces';

export interface EvaluationContext {
  session: {
    id: string;
    mode: string;
  };
  candidate: {
    name: string;
    email?: string;
    role: string;
  };
  question: Question;
  response: string;
  evaluationProfile: EvaluationProfile;
  metadata?: Record<string, any>;
}
