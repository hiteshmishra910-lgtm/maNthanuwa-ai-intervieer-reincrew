import { SessionRecord, AggregatedPerformance, QuestionPerformance } from '../types/performanceTypes';

export const aggregatePerformance = (
  sessions: SessionRecord[],
  questionPerformance: QuestionPerformance[] = []
): AggregatedPerformance => {
  const completed = sessions.filter(
    s => s.session_status === 'COMPLETED' || s.session_status === 'TERMINATED' || s.session_status === 'QUEUED'
  );

  if (completed.length === 0) {
    return {
      averageScore: 0,
      technicalScore: 0,
      communicationScore: 0,
      totalInterviews: 0,
      topStrengths: [],
      topWeaknesses: [],
      scoreTrend: [],
    };
  }

  const averageScore = Math.round(
    completed.reduce((sum, s) => sum + (s.overall_score || 0), 0) / completed.length
  );

  // Technical & Communication scores now come from the real question-level data
  const contentScores = questionPerformance
    .map(q => q.contentScore)
    .filter((s): s is number => typeof s === 'number');

  const commScores = questionPerformance
    .map(q => q.fluencyScore) // mapped from communication_score in fetchQuestionWisePerformance
    .filter((s): s is number => typeof s === 'number');

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // Scores are on a /10 scale — normalize to percentage
  const technicalScore = Math.round(avg(contentScores) * 10);
  const communicationScore = Math.round(avg(commScores) * 10);

  const countFrequency = (lists: (string[] | null)[]) => {
    const freq: Record<string, number> = {};
    lists.forEach(list => {
      (list || []).forEach(item => {
        freq[item] = (freq[item] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item]) => item);
  };

  const topStrengths = countFrequency(completed.map(s => s.strengths));
  const topWeaknesses = countFrequency(completed.map(s => s.weaknesses));

  const scoreTrend = completed
    .filter(s => s.interview_date && s.overall_score !== null)
    .sort((a, b) => new Date(a.interview_date).getTime() - new Date(b.interview_date).getTime())
    .map(s => ({
      date: s.interview_date,
      score: Math.round(s.overall_score || 0),
    }));

  return {
    averageScore,
    technicalScore,
    communicationScore,
    totalInterviews: completed.length,
    topStrengths,
    topWeaknesses,
    scoreTrend,
  };
};

// export const fetchQuestionWisePerformance = async (
//   supabase: any, // pass the client in
//   candidateName: string
// ): Promise<QuestionPerformance[]> => {
//   const { data, error } = await supabase
//     .from('vw_candidate_qa_details')
//     .select('*')
//     .eq('candidate_name', candidateName); // confirm this is the right join key

//   if (error || !data) return [];

//   return data.map((qa: any) => {
//     const contentScore = qa.technical_score || 0;
//     let suggestion = 'Good grasp of this topic — keep it up.';
//     if (contentScore < 4) {
//       suggestion = 'Revisit the core concept behind this question — foundational gaps detected.';
//     } else if (contentScore < 7) {
//       suggestion = 'Decent understanding, but add more depth or specific examples next time.';
//     }

//     return {
//       questionText: qa.question_asked || 'Question text unavailable',
//       contentScore,
//       grammarScore: qa.grammar_score,
//       fluencyScore: qa.communication_score, // note: this view uses communication_score, not fluency
//       feedback: qa.ai_justification ? JSON.parse(qa.ai_justification)?.observation : undefined,
//       suggestion,
//     };
//   });
// };
export const fetchQuestionWisePerformance = async (
  supabase: any,
  candidateName: string
): Promise<QuestionPerformance[]> => {
  const { data, error } = await supabase
    .from('vw_candidate_qa_details')
    .select('*')
    .eq('candidate_name', candidateName);

  if (error || !data) return [];

  return data.map((qa: any) => {
    const contentScore = qa.technical_score || 0;
    let suggestion = 'Good grasp of this topic — keep it up.';
    if (contentScore < 4) {
      suggestion = 'Revisit the core concept behind this question — foundational gaps detected.';
    } else if (contentScore < 7) {
      suggestion = 'Decent understanding, but add more depth or specific examples next time.';
    }

    // Safely parse ai_justification — it may be JSON or plain text
    let feedbackText: string | undefined;
    if (qa.ai_justification) {
      try {
        const parsed = JSON.parse(qa.ai_justification);
        feedbackText = parsed?.observation || undefined;
      } catch {
        // Not JSON — treat it as plain text feedback directly
        feedbackText = qa.ai_justification;
      }
    }

    return {
      questionText: qa.question_asked || 'Question text unavailable',
      contentScore,
      grammarScore: qa.grammar_score,
      fluencyScore: qa.communication_score,
      feedback: feedbackText,
      suggestion,
    };
  });
};