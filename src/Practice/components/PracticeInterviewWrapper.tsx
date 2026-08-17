import React from 'react';
import { DynamicInterviewScreen } from '../../Interview/components/DynamicInterviewScreen';
import { PracticeCandidate } from '../hooks/usePracticeSession';
import { ProctoringReport } from '../../../types';

interface PracticeInterviewWrapperProps {
  candidate: PracticeCandidate;
  onComplete: (
    history: { question: string; answer: string; ideal_answer: string }[],
    proctoringReport: ProctoringReport,
    completionResult: any
  ) => void;
}

export const PracticeInterviewWrapper: React.FC<PracticeInterviewWrapperProps> = ({
  candidate,
  onComplete,
}) => {
  return (
    <DynamicInterviewScreen
      candidate={candidate}
      onComplete={onComplete}
    />
  );
};