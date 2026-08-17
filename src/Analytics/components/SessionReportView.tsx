import React, { useState } from 'react';
import { MasterEvaluationReport, ProctoringReport, CandidateOutcome } from '../../../types';
import { SupabaseService } from '../../Core/database/supabaseService';
import {
  CheckCircle, AlertCircle, ArrowLeft, Trophy, Target,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Star, ThumbsUp, ThumbsDown, BarChart2,
  ShieldAlert, AlertTriangle, Shield, Brain, MessageSquare, Scale, HelpCircle, Activity, Info, Check, Loader2
} from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { getDisplayEvalMode } from '../../Core/utils/sessionStatusResolver';

interface SessionReportViewProps {
  candidate: { name: string; email: string; role: string; session?: any };
  evalReport: MasterEvaluationReport;
  initialOutcome?: CandidateOutcome;
  proctoringReport?: ProctoringReport | null;
  sessionId?: string | null;
  onHome?: () => void;
  mode?: 'admin' | 'candidate';
  onDecisionMade?: (outcome: CandidateOutcome)=> void;
}

const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 160 }) => {
  const r = size / 2 - 12;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * score) / 100;

  const color =
    score >= 85 ? '#10b981' :
    score >= 70 ? '#6366f1' :
    score >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="transparent"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

const MetricBar: React.FC<{ label: string; value: number; max?: number }> = ({ label, value, max = 10 }) => {
  const pct = (value / max) * 100;
  const color =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 60 ? 'bg-indigo-500' :
    pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-black text-slate-800">{value}<span className="text-slate-300 font-normal">/{max}</span></span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const getPerformanceDetails = (score: number) => {
  if (score >= 9.0) return { label: 'Excellent', color: 'bg-purple-50 text-purple-700 border-purple-200' };
  if (score >= 8.0) return { label: 'Strong', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (score >= 6.0) return { label: 'Competent', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  if (score >= 4.0) return { label: 'Developing', color: 'bg-blue-50 text-blue-700 border-blue-200' };
  if (score >= 2.0) return { label: 'Early Understanding', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Not Demonstrated', color: 'bg-rose-50 text-rose-700 border-rose-200' };
};

const renderStars = (score: number) => {
  const filled = Math.min(5, Math.max(0, Math.round(score / 2)));
  return (
    <span className="text-indigo-600 tracking-wider">
      {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
    </span>
  );
};const QuestionCard: React.FC<{ item: MasterEvaluationReport['questionBreakdown'][0]; index: number; mode?: 'admin' | 'candidate' }> = ({ item, index, mode = 'candidate' }) => {
  const [expanded, setExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // If it's an MCQ question (aptitude test)
  if (item.options && item.options.length > 0) {
    const isCorrect = item.userAnswer?.trim().toUpperCase() === item.correctAnswer?.trim().toUpperCase() || (item.score === 10);
    const isUnattempted = !item.userAnswer || item.userAnswer === 'Unattempted' || item.userAnswer === 'NONE';
    const statusColor = isCorrect 
      ? 'text-emerald-600 font-bold' 
      : (isUnattempted ? 'text-amber-500 font-bold' : 'text-rose-600 font-bold');
    const statusText = isCorrect 
      ? 'Correct' 
      : (isUnattempted ? 'Unattempted' : 'Incorrect');

    return (
      <div className={`bg-white border rounded-3xl overflow-hidden shadow-sm transition-all duration-300 ${
        expanded ? 'ring-2 ring-indigo-500/10' : ''
      }`}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left p-6 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white shrink-0 text-xs bg-slate-900">
              Q{index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-indigo-100">
                  {item.difficulty || 'medium'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  isCorrect ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  isUnattempted ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {statusText}
                </span>
              </div>
              <p className="font-bold text-slate-800 text-sm leading-snug">
                {item.questionText || (item as any).question || (item as any).text || `Question ${index + 1}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className={`text-xl font-black ${statusColor}`}>
                {isCorrect ? '10' : '0'}
              </span>
              <span className="text-slate-400 text-xs font-bold">/10</span>
            </div>
            {expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>

        {expanded && (
          <div className="px-6 pb-6 space-y-4 border-t border-slate-100 pt-4 bg-slate-50/50">
            {item.imageUrl && (
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 flex justify-center bg-slate-50 p-2">
                <img src={item.imageUrl} alt="Question Diagram" className="object-contain max-h-56" />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.options.map((opt, oIdx) => {
                const optKey = String.fromCharCode(65 + oIdx);
                const isSelected = item.userAnswer === optKey;
                const isCorrectOpt = item.correctAnswer === optKey;

                let cardStyle = 'border-slate-150 bg-white text-slate-700';
                let iconEl = null;

                if (isSelected) {
                  if (isCorrectOpt) {
                    cardStyle = 'border-emerald-500 bg-emerald-50/40 text-emerald-800 font-bold';
                    iconEl = <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white"><Check size={12} strokeWidth={3} /></div>;
                  } else {
                    cardStyle = 'border-rose-500 bg-rose-50/40 text-rose-800 font-bold';
                    iconEl = <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] font-bold">X</div>;
                  }
                } else if (isCorrectOpt) {
                  cardStyle = 'border-emerald-500 bg-emerald-50/30 text-emerald-800 font-semibold';
                  iconEl = <div className="w-5 h-5 rounded-full bg-emerald-500/50 flex items-center justify-center text-white"><Check size={12} strokeWidth={3} /></div>;
                }

                return (
                  <div key={oIdx} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${cardStyle}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                        isSelected 
                          ? (isCorrectOpt ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')
                          : (isCorrectOpt ? 'bg-emerald-500/30 text-emerald-700' : 'bg-slate-100 text-slate-500')
                      }`}>
                        {optKey}
                      </div>
                      <span className="text-xs">{opt}</span>
                    </div>
                    {iconEl}
                  </div>
                );
              })}
            </div>

            {item.explanation && (
              <div className="bg-indigo-50/40 border border-indigo-100 p-4 rounded-xl space-y-1.5">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={12} /> Solution Explanation
                </span>
                <p className="text-slate-600 text-xs leading-relaxed font-semibold">
                  {item.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Spoken Question Rendering
  const hasError = !!item.evaluationError;
  const scoreText = hasError ? 'Unevaluated' : `${item.score}`;
  const scoreColor =
    hasError ? 'text-amber-600 font-bold' :
    item.score >= 8 ? 'text-emerald-600' :
    item.score >= 6 ? 'text-indigo-600' :
    item.score >= 4 ? 'text-amber-600' : 'text-rose-600';

  // Dynamic Averages / Dimension Scores
  const knowledgeVal = item.analysis?.understanding ?? 0;
  const reasoningVal = item.analysis?.reasoning ?? 0;
  const problemSolvingVal = item.analysis?.coverage ?? 0;
  const communicationVal = item.analysis?.communication ?? 0;

  const mentioned = (item as any).mentionedConcepts || item.matchedKeyPoints || [];
  const explained = (item as any).explainedConcepts || [];
  const answerText = (item.userAnswer || '').trim();
  const textLower = answerText.toLowerCase();

  const qText = String(item.questionText || (item as any).question || (item as any).text || '').toLowerCase();
  const isIntro = qText.includes('tell me about yourself') || qText.includes('introduce') || qText.includes('background');
  const isBehav = qText.includes('tell me about a time') || qText.includes('describe a situation') || qText.includes('project') || qText.includes('mistake') || qText.includes('challenge');

  // Dynamic Content Evidence Inspection
  const hasName = /\b(my name is|i am|i'm)\b/i.test(answerText);
  const hasCollege = /\b(college|university|institute|school|campus)\b/i.test(answerText);
  const hasDegree = /\b(degree|b\.?tech|b\.?e|m\.?tech|computer science|engineering|diploma|bachelor|master)\b/i.test(answerText);
  const hasInterest = /\b(interest|passionate|focus|area of interest|aspiring|love|enjoy|aim|aiming)\b/i.test(answerText);
  const hasSkillsOrTech = /\b(python|java|javascript|typescript|react|ai|machine learning|ml|data|sql|web|backend|frontend|node|c\+\+|html|css)\b/i.test(answerText);
  const hasProjects = /\b(project|built|developed|created|worked on|app|application|website|system)\b/i.test(answerText);
  const hasAction = /\b(i fixed|i resolved|i refactored|i implemented|i built|i created|i investigated|i designed|i handled|i led)\b/i.test(answerText);
  const hasOutcome = /\b(percent|reduced|improved|solved|shipped|increased|decreased|result|achieved|outcome)\b/i.test(answerText);
  const hasMechanism = /\b(because|how|works by|internal|memory|allocates|executes|triggers|under the hood|behind the scenes)\b/i.test(answerText);
  const hasTradeoffs = /\b(however|tradeoff|slower|faster|memory cost|versus|whereas|advantage|disadvantage|limitation|drawback)\b/i.test(answerText);

  // 1. Knowledge & Understanding Reason
  const getKnowledgeReason = () => {
    if (item.score === 0 || !answerText) {
      return `Candidate did not provide a response to evaluate.`;
    }

    if (isIntro) {
      const mentionedParts: string[] = [];
      if (hasName) mentionedParts.push("name");
      if (hasCollege) mentionedParts.push("college/institution");
      if (hasDegree) mentionedParts.push("degree/stream");
      if (hasInterest || hasSkillsOrTech) mentionedParts.push("areas of interest/skills");
      if (hasProjects) mentionedParts.push("hands-on projects");

      const missingParts: string[] = [];
      if (!hasDegree) missingParts.push("degree details");
      if (!hasInterest && !hasSkillsOrTech) missingParts.push("technical skills/interests");
      if (!hasProjects) missingParts.push("specific project achievements");

      if (mentionedParts.length > 0) {
        const stated = mentionedParts.join(", ");
        if (missingParts.length > 0) {
          return `Stated ${stated}. Missed mentioning ${missingParts.slice(0, 2).join(" and ")}.`;
        }
        return `Comprehensive self-introduction covering ${stated}.`;
      }
      return `Provided a brief introductory response lacking specific background details.`;
    }

    if (isBehav) {
      if (hasProjects || hasAction) {
        if (hasOutcome) return `Described a specific past experience with individual action and outcome.`;
        return `Mentioned a relevant experience and action taken, but omitted quantitative outcome metrics.`;
      }
      return `Provided general statements without describing a specific past project or workplace incident.`;
    }

    // Technical Question
    const terms = (mentioned.length > 0 ? mentioned : explained).slice(0, 2).map((c: string) => c.replace(/_/g, ' '));
    if (hasMechanism) {
      return terms.length > 0 
        ? `Explained the core mechanism of ${terms.join(" and ")}.`
        : `Explained the underlying technical mechanism clearly.`;
    }
    if (terms.length > 0) {
      return `Mentioned ${terms.join(" and ")}, but did not fully elaborate on the underlying mechanism.`;
    }
    if (item.score >= 5.0) {
      return `Demonstrated basic conceptual awareness of the topic.`;
    }
    return `Limited explanation details on the core technical subject matter.`;
  };

  // 2. Reasoning Reason
  const getReasoningReason = () => {
    if (item.score === 0 || !answerText) {
      return `Unable to assess reasoning due to lack of valid response.`;
    }
    if (isIntro) {
      if (hasInterest || hasSkillsOrTech) {
        return `Expressed career alignment and motivation in ${hasSkillsOrTech ? 'technical domain' : 'the role'}.`;
      }
      return `Basic personal statement; specific career motivations and goals can be elaborated further.`;
    }
    if (isBehav) {
      if (hasAction && hasOutcome) {
        return `Logical decision-making sequence with verified individual ownership and outcome.`;
      }
      if (hasAction) {
        return `Logical step-by-step action described, but lacked quantitative outcome metrics.`;
      }
      return `Offered theoretical opinion instead of detailing a structured decision-making process.`;
    }

    // Technical Question
    if (hasTradeoffs) {
      return `Demonstrated strong technical reasoning with explicit trade-off analysis and alternatives.`;
    }
    if (reasoningVal >= 5 || item.score >= 6.0) {
      return `Structured response provided, but missed deeper technical trade-offs or edge-case reasoning.`;
    }
    return `Logical chain of thought was incomplete or lacked practical trade-off analysis.`;
  };

  // 3. Problem Solving Reason
  const getProblemSolvingReason = () => {
    if (item.score === 0 || !answerText) {
      return `No solution attempted or provided by the candidate.`;
    }
    if (isIntro) {
      return `Addressed the introductory prompt directly with background information.`;
    }
    if (isBehav) {
      return hasOutcome
        ? `Directly resolved the situation with clear individual action and positive outcome.`
        : `Described problem-solving effort, but omitted specific outcome metrics.`;
    }
    if (item.score >= 8.0) {
      return `Directly answered the question with a complete technical solution.`;
    }
    if (item.score >= 5.0) {
      return `Attempted the core question, but answer lacked required depth or concrete examples.`;
    }
    return `Response did not sufficiently satisfy the specific problem asked.`;
  };

  // 4. Communication Reason
  const getCommunicationReason = () => {
    if (item.score === 0 || !answerText) {
      return `No response provided to assess communication skills.`;
    }
    const words = answerText.split(/\s+/).length;
    if (words < 10) {
      return `Response was extremely brief (${words} words).`;
    }
    if (communicationVal >= 8) {
      return `Clear, articulate explanation with structured delivery.`;
    }
    if (communicationVal >= 5) {
      return `Communicated main thoughts, with minor hesitation or informal phrasing.`;
    }
    return `Explanation was unstructured or difficult to follow.`;
  };  

  // Speech Metrics Mapping
  const isUnanswered = !item.userAnswer || item.userAnswer.trim() === '';

  const pace = isUnanswered ? 'N/A' : (item.speechMetrics?.speakingRate
    ? (item.speechMetrics.speakingRate > 165 ? 'Fast' : item.speechMetrics.speakingRate < 115 ? 'Slow' : 'Optimal')
    : 'Optimal');
  const clarity = isUnanswered ? 'N/A' : (communicationVal >= 8 ? 'Clear' : communicationVal >= 5 ? 'Moderate' : 'Needs Structure');
  const fillers = isUnanswered ? 'N/A' : (item.speechMetrics?.fillerRate
    ? (item.speechMetrics.fillerRate > 8 ? 'High' : item.speechMetrics.fillerRate > 4 ? 'Moderate' : 'Minimal')
    : 'Minimal');

  // Recruiter Hiring Impact Mapping
  let hiringImpact = "";
  if (item.score >= 8.5) {
    hiringImpact = "Strong Positive. Candidate demonstrated comprehensive mastery of the topic with excellent depth and logical structure.";
  } else if (item.score >= 7.0) {
    hiringImpact = "Positive. Candidate understands core principles well, with minor gaps in tradeoffs or advanced concepts.";
  } else if (item.score >= 5.0) {
    hiringImpact = "Neutral. Basic understanding demonstrated, but candidate requires guidance or supervision on this topic.";
  } else {
    hiringImpact = "Concern / Gap. Severe conceptual gaps, technical inaccuracies, or listed keywords without explanation.";
  }

  // Calibration status
  const confGap = (item as any).confidenceGap ?? 0;
  const calibrationStatus = isUnanswered ? 'N/A' : (Math.abs(confGap) <= 2 ? 'CALIBRATED' : confGap > 2 ? 'OVERCONFIDENT' : 'UNDERCONFIDENT');

  return (
    <div className={`bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm transition-all duration-300 ${
      expanded ? 'ring-2 ring-indigo-500/10' : ''
    }`}>
      {/* Layer 1: Always Visible Header */}
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex-1 text-left flex items-start gap-3 sm:gap-4 min-w-0"
          >
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-white shrink-0 text-xs ${
              hasError ? 'bg-rose-500' : 'bg-slate-900'
            }`}>
              Q{index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  item.difficulty === 'hard' ? 'bg-red-50 text-red-600 border border-red-100' :
                  item.difficulty === 'medium' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                  'bg-slate-50 text-slate-600 border border-slate-100'
                }`}>
                  {item.difficulty}
                </span>
                {item.transcriptionQualityScore !== undefined && (
                  <span className="text-slate-400 text-[10px] font-bold">
                    {item.transcriptionQualityScore}% transcript confidence
                  </span>
                )}
              </div>
              <p className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug">
                {item.questionText || (item as any).question || (item as any).text || `Question ${index + 1}`}
              </p>
            </div>
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <span className={`text-xl sm:text-2xl font-black ${scoreColor}`}>{scoreText}</span>
              {!hasError && <span className="text-slate-400 text-[10px] sm:text-xs font-bold">/10</span>}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {expanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
            </button>
          </div>
        </div>

        {/* Candidate Answer (Always visible inside Layer 1) */}
        <div className="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Candidate Answer</p>
          <p className="text-sm text-slate-700 leading-relaxed font-medium italic">
            "{item.userAnswer || 'No response recorded.'}"
          </p>
        </div>
      </div>

      {/* Layer 2: Expanded Content */}
      {expanded && (
        <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 space-y-6 bg-slate-50/20">
          
          {hasError ? (
            <div className="bg-rose-50 border border-rose-250 text-rose-800 rounded-2xl p-4 flex gap-3 items-start text-sm">
              <AlertTriangle className="shrink-0 mt-0.5 text-rose-600" size={16} />
              <div>
                <p className="font-bold">Evaluation System Error</p>
                <p className="text-xs text-rose-700 leading-relaxed mt-1">This answer could not be evaluated by the engine:</p>
                <code className="block bg-rose-100 p-2 rounded mt-2 font-mono text-[10px] wrap-break-word text-rose-900">
                  {item.evaluationError}
                </code>
              </div>
            </div>
          ) : (
            <>
              {/* 1. Evaluation Breakdown */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Evaluation Breakdown</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Knowledge & Understanding */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700">Knowledge & Understanding</span>
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{Math.round(knowledgeVal)}/10</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                        {getKnowledgeReason()}
                      </p>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700">Reasoning</span>
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{Math.round(reasoningVal)}/10</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                        {getReasoningReason()}
                      </p>
                    </div>
                  </div>

                  {/* Problem Solving */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700">Problem Solving</span>
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{Math.round(problemSolvingVal)}/10</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                        {getProblemSolvingReason()}
                      </p>
                    </div>
                  </div>

                  {/* Communication */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700">Communication</span>
                        <span className="text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{Math.round(communicationVal)}/10</span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                        {getCommunicationReason()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Alignment & Relevance */}
              {item.questionAlignment && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Alignment & Relevance</p>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        item.questionAlignment.answeredQuestion
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        {item.questionAlignment.answeredQuestion ? 'Answered' : 'Not Answered / Misaligned'}
                      </span>
                      {item.questionAlignment.offTopic && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          Off-Topic
                        </span>
                      )}
                      {item.questionAlignment.genericMemorizedAnswer && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          Generic / Memorized Template
                        </span>
                      )}
                      {item.questionAlignment.answeredDifferentQuestion && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                          Answered Different Question
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{item.questionAlignment.explanation}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Topic Alignment</span>
                        <span className="font-extrabold text-slate-800">{Math.round(item.questionAlignment.topicScore * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Intent Match</span>
                        <span className="font-extrabold text-slate-800">{Math.round(item.questionAlignment.intentScore * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Scenario Coverage</span>
                        <span className="font-extrabold text-slate-800">{Math.round(item.questionAlignment.scenarioScore * 100)}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Evidence Match</span>
                        <span className="font-extrabold text-slate-800">{Math.round(item.questionAlignment.evidenceScore * 100)}%</span>
                      </div>
                    </div>
                    {item.questionAlignment.requiredElementsMissing.length > 0 && (
                      <div className="text-[11px] text-slate-500 font-medium pt-1">
                        <span className="text-rose-500 font-bold">Missing Elements:</span> {item.questionAlignment.requiredElementsMissing.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 2. AI Summary */}
              {item.feedback?.observation && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Summary</p>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                    <p className="text-xs text-slate-650 font-medium leading-relaxed italic">
                      "{item.feedback.observation}"
                    </p>
                  </div>
                </div>
              )}

              {/* 3. Next Steps (Candidate) OR Hiring Impact (Recruiter) */}
              {mode === 'candidate' ? (
                item.feedback?.nextSteps && item.feedback.nextSteps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Steps</p>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                      <ul className="space-y-1.5">
                        {item.feedback.nextSteps.map((step, sIdx) => (
                          <li key={sIdx} className="text-xs text-slate-600 font-semibold flex items-start gap-2">
                            <span className="text-indigo-500">•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hiring Impact</p>
                  <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100">
                    <p className="text-xs text-indigo-950 font-bold leading-relaxed">
                      {hiringImpact}
                    </p>
                  </div>
                </div>
              )}

              {/* Layer 3: Advanced Details (Collapsed by default) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors outline-none"
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showAdvanced ? 'Hide Advanced Details' : 'View Advanced Details'}</span>
                </button>

                {showAdvanced && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
                    
                    {/* Speech Feedback */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Speech Feedback</span>
                      <div className="space-y-1.5 text-xs font-medium text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Pace:</span>
                          <span className="font-bold text-slate-700">{pace}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Clarity:</span>
                          <span className="font-bold text-slate-700">{clarity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Filler Words:</span>
                          <span className="font-bold text-slate-700">{fillers}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence Calibration */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confidence Calibration</span>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
                          {isUnanswered ? 'Confidence calibration could not be assessed.' :
                           calibrationStatus === 'CALIBRATED' ? 'Speech confidence matched technical response scoring.' :
                           calibrationStatus === 'OVERCONFIDENT' ? 'High spoken confidence but missed technical content details.' :
                           'Technical content was stronger than delivery confidence suggested.'}
                        </p>
                      </div>
                      <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-2 text-center border ${
                        isUnanswered ? 'bg-slate-50 text-slate-500 border-slate-200' :
                        calibrationStatus === 'CALIBRATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {calibrationStatus}
                      </span>
                    </div>

                    {/* Misconception Risk */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Misconception Risk</span>
                        <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
                          {isUnanswered ? 'No response provided to evaluate misconceptions.' :
                           item.technicalErrors && item.technicalErrors.length > 0 
                            ? `Potential conceptual misunderstanding identified on technical errors.`
                            : `No conceptual misunderstandings flagged for this topic.`}
                        </p>
                      </div>
                      {isUnanswered ? (
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded mt-2 text-center">
                          N/A
                        </span>
                      ) : (item.technicalErrors && item.technicalErrors.length > 0) ? (
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded mt-2 text-center">
                          Potential Misunderstanding
                        </span>
                      ) : (
                        <span className="inline-block text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-250 px-2 py-0.5 rounded mt-2 text-center">
                          Clear Foundations
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const getCandidateFriendlyRecommendation = (rec: string) => {
  if (rec === 'Strong Hire') return 'Exceptional Alignment';
  if (rec === 'Hire') return 'Strong Potential';
  if (rec === 'Consider') return 'Growing Foundations';
  return 'Needs Development';
};

export const SessionReportView: React.FC<SessionReportViewProps> = ({
  candidate,
  evalReport,
  initialOutcome,
  sessionId,
  onHome,
  mode = 'candidate',
  onDecisionMade,
}) => {
  const report = evalReport;

  const [outcome, setOutcome] = useState<CandidateOutcome>(initialOutcome ?? report?.candidateOutcome ?? 'PENDING');
  const [reviewerNotes, setReviewerNotes] = useState<string>(report?.reviewerNotes || '');
  const [wasOverridden, setWasOverridden] = useState<boolean>(report?.wasOverridden || false);
  const [isSaving, setIsSaving] = useState(false);


  // If the report is an error stub because the actual report/responses failed to load
  if ((report as any)?._isMissingData) {
    const errorReport = report as any;
    return (
      <div className="w-full text-slate-900 font-sans p-8 animate-in fade-in duration-500 max-w-5xl mx-auto space-y-6">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 flex flex-col items-center text-center shadow-sm">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Evaluation Status: Data Missing</h2>
          <p className="text-rose-700 font-medium max-w-lg mb-6">
            {errorReport.reason || 'The evaluation report could not be reconstructed because response data is missing.'}
          </p>
          <div className="flex gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Score</span>
              <span className="text-2xl font-black text-slate-800">{errorReport.finalScore}%</span>
            </div>
          </div>
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="mt-8 px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 text-sm border border-slate-200 shadow-sm"
            >
              <ArrowLeft size={16} /> Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleSaveDecision = async (newOutcome: CandidateOutcome) => {
    if (!sessionId) return;
    setIsSaving(true);

    const isOverride = newOutcome !== 'PENDING' && (newOutcome as string) !== (report.executiveSummary?.recommendation as string);
    const ok = await SupabaseService.updateCandidateOutcome(
      sessionId,
      newOutcome,
      isOverride,
      reviewerNotes,
      'Recruiter'
    );

    setIsSaving(false);
    if (ok) {
      setOutcome(newOutcome);
      setWasOverridden(isOverride);
      onDecisionMade?.(newOutcome);
    }
  };

  const isAptitudeReport = !!report.aptitudeSummary || candidate.role === 'APTITUDE' || report.questionBreakdown?.some(q => q.options && q.options.length > 0);

  // Question counts are derived from the report, not from a hardcoded interview length.
  //
  // `expectedQuestions` used to be the literal 10. Two things went wrong with that:
  //   1. Adaptive follow-ups are appended to questionBreakdown, so a candidate who answered all
  //      10 planned questions plus one follow-up was shown "11 / 10".
  //   2. Any interview legitimately configured with fewer than 10 questions was labelled
  //      "Early Interview Termination Detected" and told the recruiter the candidate had walked
  //      out — an accusation manufactured entirely by the constant.
  //
  // Follow-ups are excluded from both sides of the ratio so it describes the planned interview.
  // Reports written before `isFollowUp` was recorded have the flag absent on every entry, which
  // makes primary === total and reproduces the previous numerator exactly.
  const breakdown = report.questionBreakdown || [];
  const primaryQuestions = breakdown.filter((q: any) => !q.isFollowUp);
  const followUpCount = breakdown.length - primaryQuestions.length;
  const actualQuestions = primaryQuestions.length;
  // The number of questions the interview intended to ask, when the report records it.
  const plannedQuestions =
    (report as any).metadata?.plannedQuestionCount ??
    (report as any).executiveSummary?.plannedQuestionCount ??
    null;
  const expectedQuestions = typeof plannedQuestions === 'number' && plannedQuestions > 0
    ? plannedQuestions
    : actualQuestions;
  // Only claim an early exit on recorded evidence: either the proctoring engine actually
  // terminated the session, or the report carries a planned question count that was not met.
  // Inventing a target to measure against is what produced the false banner.
  const wasTerminated = report.proctoringSummary?.isTerminated === true;
  const missedPlannedQuestions =
    typeof plannedQuestions === 'number' && plannedQuestions > 0 && actualQuestions < plannedQuestions;
  const isTerminatedEarly = wasTerminated || missedPlannedQuestions;

  const terminationWarningBanner = isTerminatedEarly ? (
    <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center gap-4 text-rose-700 shadow-sm animate-in fade-in duration-305">
      <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0 border border-rose-200">
        <AlertTriangle className="w-6 h-6 text-rose-600" />
      </div>
      <div className="space-y-1">
        <h4 className="font-extrabold text-sm md:text-base text-rose-900 tracking-tight">Early Interview Termination Detected</h4>
        <p className="text-xs md:text-sm font-medium text-rose-650 leading-relaxed font-sans">
          {missedPlannedQuestions
            ? `This session ended after ${actualQuestions} of ${expectedQuestions} planned questions. `
            : `This session was ended before it ran to completion. `}
          {report.proctoringSummary?.terminationReason
            ? `Recorded reason: ${report.proctoringSummary.terminationReason}.`
            : `This is typically caused by the candidate closing or refreshing the tab, or by automatic termination from the proctoring engine (e.g. camera disconnected, tab switches, or face missing beyond the configured threshold).`}
        </p>
      </div>
    </div>
  ) : null;

  if (isAptitudeReport) {
    const aptSummary = report.aptitudeSummary || {
      correct: report.questionBreakdown?.filter(q => q.score === 10).length || 0,
      incorrect: report.questionBreakdown?.filter(q => q.score === 0 && q.userAnswer !== 'Unattempted').length || 0,
      unattempted: report.questionBreakdown?.filter(q => q.userAnswer === 'Unattempted').length || 0,
      accuracy: report.executiveSummary?.technicalScore || 0,
      trustScore: report.executiveSummary?.trustScore || 100,
      timeSpentSeconds: 0,
      categoryBreakdown: {},
      improvements: report.topImprovements || []
    };

    const integrityScoreVal = report.proctoringSummary?.integrityScore ?? aptSummary.trustScore ?? 100;
    const finalAccuracy = aptSummary.accuracy ?? Math.round((aptSummary.correct / 10) * 100);
    
    const durationSeconds = aptSummary.timeSpentSeconds || (report.proctoringSummary?.sessionDurationMs ? Math.round(report.proctoringSummary.sessionDurationMs / 1000) : 0);
    const formatDuration = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    return (
      <div className="w-full text-slate-900 font-sans animate-in fade-in duration-500">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Brain className="text-indigo-600" size={16} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {mode === 'admin' ? 'Candidate Aptitude Readiness Report (Admin)' : 'Your Aptitude Growth Report'}
                </span>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                {mode === 'admin' ? candidate.name : `Hi, ${candidate.name}!`}
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Role Focus: <span className="text-slate-900 font-bold">Aptitude Test</span> | Date: <span className="text-slate-700 font-semibold">{new Date().toLocaleDateString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {mode === 'admin' && (
                <div className="text-right hidden md:block">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation Mode</p>
                  <p className="text-xs font-mono font-bold text-slate-700">Objective MCQ</p>
                </div>
              )}
              <Logo className="w-10 h-10 opacity-70" />
            </div>
          </header>

          {terminationWarningBanner}

          {/* Core Decision Cards */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Performance score card */}
            <div className="md:col-span-4 bg-white border border-slate-200 rounded-4xl p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aptitude Accuracy</span>
              <div className="relative flex items-center justify-center">
                <ScoreRing score={finalAccuracy} size={140} />
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-800">{aptSummary.correct}/10</span>
                  <span className="text-xs text-slate-400 block mt-0.5">{finalAccuracy}% Accuracy</span>
                </div>
              </div>
            </div>

            {/* Integrity / Trust Score Card (Separate!) */}
            <div className="md:col-span-4 bg-white border border-slate-200 rounded-4xl p-6 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Integrity / Trust Score</span>
              <div className="relative flex items-center justify-center">
                <ScoreRing score={integrityScoreVal} size={140} />
                <div className="absolute text-center">
                  <span className="text-3xl font-black text-slate-800">{integrityScoreVal}%</span>
                  <span className="text-xs text-slate-400 block mt-0.5">Trust Integrity</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics stats */}
            <div className="md:col-span-4 bg-white border border-slate-200 rounded-4xl p-6 shadow-sm flex flex-col justify-between space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Test Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-500">Correct Answers</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{aptSummary.correct}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-500">Incorrect Answers</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">{aptSummary.incorrect}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-slate-500">Unattempted</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">{aptSummary.unattempted}</span>
                </div>
                {durationSeconds > 0 && (
                  <div className="flex justify-between items-center text-xs font-medium border-t border-slate-100 pt-2.5">
                    <span className="text-slate-500">Time Taken</span>
                    <span className="font-bold text-slate-800">{formatDuration(durationSeconds)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Executive Summary Block */}
          {report.executiveSummary?.summary && (
            <section className="bg-white border border-slate-200 rounded-4xl p-6 md:p-8 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-2">
                <Info size={16} /> Executive Summary
              </h3>
              <p className="text-slate-700 text-sm leading-relaxed font-semibold italic">
                "{report.executiveSummary.summary}"
              </p>
            </section>
          )}

          {/* Category-wise Performance and AI Actionable Improvements */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category accuracy bars */}
            <div className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BarChart2 size={16} className="text-indigo-600" /> Category Breakdown
              </h3>
              <div className="space-y-4">
                {Object.keys(aptSummary.categoryBreakdown || {}).length > 0 ? (
                  Object.entries(aptSummary.categoryBreakdown).map(([cat, data]: [string, any]) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-650">{cat}</span>
                        <span className="text-slate-800">{data.correct}/{data.total} ({data.accuracy}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                          style={{ width: `${data.accuracy}%` }} 
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback category calculations from questionBreakdown
                  ['Quantitative', 'Logical', 'Analytical', 'Verbal'].map(cat => {
                    const catQs = report.questionBreakdown?.filter(q => (q as any).category === cat) || [];
                    const total = catQs.length;
                    const correct = catQs.filter(q => q.score === 10).length;
                    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                    if (total === 0) return null;

                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-650">{cat}</span>
                          <span className="text-slate-800">{correct}/{total} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* AI Actionable Improvements */}
            <div className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Trophy size={16} className="text-indigo-600" /> Actionable Improvements
              </h3>
              <div className="grid gap-3">
                {(aptSummary.improvements || []).slice(0, 3).map((imp: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-semibold leading-relaxed">
                    <div className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full border-2 border-indigo-400 bg-white shrink-0 text-xs font-black text-indigo-600">
                      {idx + 1}
                    </div>
                    <p className="text-sm text-slate-700">{imp}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Gaze Warnings and Proctor Details */}
          <div className="bg-white border border-slate-200 rounded-4xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-500" /> Proctor violations & logs
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tab Switches</span>
                <span className="text-xl font-black text-slate-700 mt-1 block">{report.proctoringSummary?.tabSwitches ?? 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Camera Away / Gaze</span>
                <span className="text-xl font-black text-slate-700 mt-1 block">
                  {report.proctoringSummary?.faceAwayEvents ?? (report.proctoringSummary as any)?.gazeAwayEvents ?? 0}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Multiple Person</span>
                <span className="text-xl font-black text-slate-700 mt-1 block">{report.proctoringSummary?.multiplePersonEvents ?? 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Warnings Issued</span>
                <span className="text-xl font-black text-slate-700 mt-1 block">{report.proctoringSummary?.warningsIssued ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Detailed Question breakdown */}
          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-2">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <MessageSquare size={20} className="text-indigo-600" /> Detailed Question Proofs
              </h2>
            </div>
            <div className="space-y-4">
              {report.questionBreakdown && report.questionBreakdown.length > 0 ? (
                report.questionBreakdown.map((item, idx) => (
                  <QuestionCard key={idx} item={item} index={idx} mode={mode} />
                ))
              ) : (
                <p className="text-xs font-medium text-slate-400 italic">No question breakdown available.</p>
              )}
            </div>
          </section>

          {/* Home button footer */}
          {onHome && (
            <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-3xl sm:rounded-4xl p-5 sm:p-6 shadow-xl mt-12">
              <div>
                <h4 className="text-sm font-bold">Feedback Record Finalized</h4>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Your report has been saved to your profile.</p>
              </div>
              <button
                type="button"
                onClick={onHome}
                className="w-full sm:w-auto px-6 py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ArrowLeft size={16} /> Return to Home
              </button>
            </footer>
          )}
        </div>
      </div>
    );
  }

  const hiringColors: Record<string, string> = {
    'Strong Hire': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Hire': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Consider': 'bg-amber-50 text-amber-700 border-amber-250',
    'Reject': 'bg-rose-50 text-rose-700 border-rose-200',
  };

  const integrityScore = report.proctoringSummary?.integrityScore ?? 100;
  const isInsufficientEvidence = report.executiveSummary?.recommendationStatus === 'insufficient_evidence';

  // Statistics calculations
  const durationSeconds = report.proctoringSummary?.sessionDurationMs
    ? Math.round(report.proctoringSummary.sessionDurationMs / 1000)
    : 0;
  const questionsAttempted = actualQuestions;
  // Was `questionsAttempted < 10`, which reported "Terminated Early" for every interview shorter
  // than ten questions regardless of whether it ran to completion. `isTerminatedEarly` is only
  // true when the report carries a planned count that was not met.
  const interviewStatus = isTerminatedEarly ? 'Terminated Early' : 'Completed';

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getIntegrityVerdict = (score: number) => {
    if (score >= 90) return 'Guidelines Fully Respected';
    if (score >= 70) return 'Minor Deviations Detected';
    return 'Flagged for Review';
  };
  const integrityVerdict = getIntegrityVerdict(integrityScore);

  // Overall Score Breakdown dimensions
  const overallKnowledge = report.overallScores?.knowledgeScore ?? 0;
  const overallReasoning = report.overallScores?.reasoningScore ?? 0;
  const overallProblemSolving = report.overallScores?.difficultyWeightedPerformance ?? report.overallScores?.knowledgeScore ?? 0;
  const overallCommunication = report.overallScores?.communicationScore ?? 0;

  // Recommended Next Topics logic (Candidates)
  interface RecommendationRow {
    topic: string;
    why: string;
    impact: 'High' | 'Medium' | 'Low';
  }
  const nextTopics: RecommendationRow[] = [];
  if (report.topImprovements && report.topImprovements.length > 0) {
    report.topImprovements.slice(0, 4).forEach((imp, idx) => {
      let impact: 'High' | 'Medium' | 'Low' = 'Medium';
      if (idx === 0) impact = 'High';
      else if (idx === 1 || idx === 2) impact = 'Medium';
      else impact = 'Low';

      let topic = imp;
      let why = "Identified as a growth opportunity in your feedback.";
      if (imp.includes(':')) {
        const parts = imp.split(':');
        topic = parts[0].trim();
        why = parts[1].trim();
      } else if (imp.includes(' - ')) {
        const parts = imp.split(' - ');
        topic = parts[0].trim();
        why = parts[1].trim();
      }
      nextTopics.push({ topic, why, impact });
    });
  } else {
    // Fallback from weaknesses
    (report.weaknesses || []).slice(0, 3).forEach((weak, idx) => {
      let impact: 'High' | 'Medium' | 'Low' = 'Medium';
      if (idx === 0) impact = 'High';
      else if (idx === 1) impact = 'Medium';
      else impact = 'Low';
      nextTopics.push({
        topic: weak.split(' - ')[0] || weak,
        why: "Weak explanation or missing conceptual depth.",
        impact
      });
    });
  }

  // 1. Candidate View Rendering
  if (mode === 'candidate') {
    const performanceScore = report.executiveSummary?.interviewPerformanceScore ?? report.overallScores?.interviewPerformanceScore ?? 0;
    const candidateLevel = report.executiveSummary?.candidateLevel ?? 'Foundation Building';

    // State for details dropdowns
    const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);
    const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

    return (
      <div className="w-full text-slate-900 font-sans animate-in fade-in duration-500">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header (Candidate Info) */}
          <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Candidate Information
              </span>
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{candidate.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                <span>ID: <span className="text-slate-800 font-bold">{sessionId?.slice(0, 8) || 'N/A'}</span></span>
                <span>•</span>
                <span>Role: <span className="text-slate-800 font-bold">{candidate.role} Branch</span></span>
                <span>•</span>
                <span>Date: <span className="text-slate-800 font-bold">{new Date().toLocaleDateString()}</span></span>
              </div>
            </div>
            <Logo className="w-10 h-10 opacity-70" />
          </header>

          {terminationWarningBanner}

          {/* Overall Performance */}
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Performance</h3>
              <span className="text-[10px] text-slate-400 font-semibold italic">How did I perform?</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Score ring */}
              <div className="md:col-span-4 flex flex-col items-center justify-center text-center py-2 border-r border-slate-100 pr-0 md:pr-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Overall Score</span>
                <div className="relative flex items-center justify-center">
                  <ScoreRing score={performanceScore} size={130} />
                  <div className="absolute text-center">
                    <span className="text-2xl font-black text-slate-800">{performanceScore}%</span>
                    <span className="text-[10px] text-indigo-600 block font-bold uppercase tracking-wide mt-0.5">{candidateLevel}</span>
                  </div>
                </div>
              </div>

              {/* Breakdown and Executive Summary */}
              <div className="md:col-span-8 space-y-4">
                {/* Score Breakdown toggle */}
                <div className="border border-slate-150 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                    className="w-full bg-slate-50 px-4 py-3 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span>▼ Expandable Evaluation Breakdown</span>
                    {showScoreBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  
                  {showScoreBreakdown && (
                    <div className="p-4 border-t border-slate-150 space-y-3 bg-white animate-in fade-in duration-200">
                      <MetricBar label="Knowledge" value={overallKnowledge / 10} />
                      <MetricBar label="Reasoning" value={overallReasoning / 10} />
                      <MetricBar label="Problem Solving" value={overallProblemSolving / 10} />
                      <MetricBar label="Communication" value={overallCommunication / 10} />
                    </div>
                  )}
                </div>

                {/* Executive Summary */}
                {report.executiveSummary?.summary && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Executive Summary</p>
                    <p className="text-xs text-slate-600 leading-relaxed font-semibold italic">
                      "{report.executiveSummary.summary}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Interview Statistics */}
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interview Statistics</h3>
              <span className="text-[10px] text-slate-400 font-semibold italic">What happened during my interview?</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interview Duration</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{formatDuration(durationSeconds)}</span>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Questions Attempted</span>
                <span className="text-lg font-black text-slate-800 mt-1 block">{questionsAttempted} / {expectedQuestions}</span>
                {followUpCount > 0 && (
                  <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                    + {followUpCount} adaptive follow-up{followUpCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interview Status</span>
                <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  interviewStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {interviewStatus}
                </span>
              </div>
            </div>
          </section>

          {/* Interview Integrity */}
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interview Integrity</h3>
              <span className="text-[10px] text-slate-400 font-semibold italic">Was my interview considered valid?</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integrity Score</span>
                  <span className="text-xl font-black text-slate-850 block mt-1">{integrityScore}%</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Verdict</span>
                  <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                    integrityScore >= 90 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    integrityScore >= 70 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-250'
                  }`}>
                    {integrityVerdict}
                  </span>
                </div>
              </div>
            </div>

            {/* View Details Accordion (For Tab Switches/Eye tracking/Warnings) */}
            <div className="border border-slate-150 rounded-2xl overflow-hidden mt-3">
              <button
                type="button"
                onClick={() => setShowIntegrityDetails(!showIntegrityDetails)}
                className="w-full bg-slate-50 px-4 py-3 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <span>▼ View Details</span>
                {showIntegrityDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showIntegrityDetails && (
                <div className="p-4 border-t border-slate-150 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white animate-in fade-in duration-200">
                  <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-450 uppercase block">Tab Switches</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.tabSwitches ?? 0}</span>
                  </div>
                  <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-450 uppercase block">Camera Events</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.faceAwayEvents ?? 0}</span>
                  </div>
                  <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-450 uppercase block">Eye Tracking Deviations</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">
                      {(report.proctoringSummary as any)?.gazeAwayEvents ?? report.proctoringSummary?.faceAwayEvents ?? 0}
                    </span>
                  </div>
                  <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-450 uppercase block">Warnings Issued</span>
                    <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.warningsIssued ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Final Question Breakdown */}
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <MessageSquare size={20} className="text-indigo-650" /> Final Question Breakdown
              </h2>
              <span className="text-[10px] text-slate-400 font-semibold italic">Why did I receive each score?</span>
            </div>
            <div className="space-y-4">
              {report.questionBreakdown && report.questionBreakdown.length > 0 ? (
                report.questionBreakdown.map((item, idx) => (
                  <QuestionCard key={idx} item={item} index={idx} mode="candidate" />
                ))
              ) : (
                <p className="text-xs font-medium text-slate-400 italic">No questions recorded in this session.</p>
              )}
            </div>
          </section>

          {/* Overall Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Strengths */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <Trophy className="text-emerald-500" size={16} /> Overall Strengths
              </h3>
              <div className="space-y-2">
                {report.strengths && report.strengths.length > 0 ? (
                  report.strengths.slice(0, 3).map((str, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 bg-emerald-50/25 p-3 rounded-xl border border-emerald-100/50">
                      <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={14} />
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">{str}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-medium text-slate-400 italic">No overall strengths identified.</p>
                )}
              </div>
            </div>

            {/* Overall Areas to Improve */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <Target className="text-rose-500" size={16} /> Overall Areas to Improve
              </h3>
              <div className="space-y-2">
                {report.weaknesses && report.weaknesses.length > 0 ? (
                  report.weaknesses.slice(0, 3).map((weak, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 bg-rose-50/25 p-3 rounded-xl border border-rose-100/50">
                      <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={14} />
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">{weak}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-medium text-slate-400 italic">No overall areas to improve identified.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recommended Next Topics Table */}
          <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Brain size={16} className="text-indigo-600" /> Recommended Next Topics
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold italic">What should I learn next?</span>
            </div>

            {nextTopics.length > 0 ? (
              <div>
                {/* Mobile Card Layout (< sm) */}
                <div className="sm:hidden space-y-3">
                  {nextTopics.map((row, rIdx) => (
                    <div key={rIdx} className="p-4 border border-slate-150 rounded-2xl bg-white space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{row.topic}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                          row.impact === 'High' ? 'bg-red-50 text-red-750 border-red-200' :
                          row.impact === 'Medium' ? 'bg-amber-50 text-amber-750 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {row.impact} Impact
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{row.why}</p>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>= sm) */}
                <div className="hidden sm:block overflow-x-auto border border-slate-150 rounded-2xl">
                  <table className="min-w-full divide-y divide-slate-150 text-left">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Topic</th>
                        <th className="px-4 py-3">Why it matters</th>
                        <th className="px-4 py-3">Estimated Impact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 bg-white text-xs font-semibold text-slate-700">
                      {nextTopics.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 font-bold text-slate-900">{row.topic}</td>
                          <td className="px-4 py-3.5 text-slate-500 leading-normal">{row.why}</td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              row.impact === 'High' ? 'bg-red-50 text-red-750 border-red-200' :
                              row.impact === 'Medium' ? 'bg-amber-50 text-amber-750 border-amber-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {row.impact}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-400 italic">No topics recommendations available.</p>
            )}
          </section>

          {/* Return home footer */}
          {onHome && (
            <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md mt-8">
              <div>
                <h4 className="text-sm font-bold">Feedback Record Finalized</h4>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Your report has been saved to your student profile.</p>
              </div>
              <button
                type="button"
                onClick={onHome}
                className="w-full sm:w-auto px-6 py-3 bg-white text-slate-900 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ArrowLeft size={16} /> Return to Home
              </button>
            </footer>
          )}
        </div>
      </div>
    );
  }

  // 2. Recruiter View Rendering (mode === 'admin')
  const isProcessing = report.executiveSummary?.recommendationStatus === 'processing';
  const verdict = isProcessing ? 'PROCESSING' : (report.executiveSummary?.recommendation ?? 'Pending Evaluation');
  const trustAdjustedScore = report.overallScores?.trustAdjustedScore ?? report.executiveSummary?.trustScore ?? 0;
  const reliabilityScore = report.executiveSummary?.answerReliabilityScore ?? report.overallScores?.answerReliabilityScore ?? 100;
  const integrityVerdictRecruiter = integrityScore >= 80 && reliabilityScore >= 70 ? 'Trusted' : 'Requires Review';

  const contradictionsCount = report.contradictions?.filter(c => c.status === 'confirmed').length ?? 0;
  const misconceptionsCount = report.questionBreakdown?.filter(q => q.technicalErrors && q.technicalErrors.length > 0).length ?? 0;
  const confGap = report.overallScores?.confidenceGap ?? 0;
  const hasConfidenceMismatch = Math.abs(confGap) > 2.5;

  const [showRecruiterScoreBreakdown, setShowRecruiterScoreBreakdown] = useState(false);
  const [showProctorSummary, setShowProctorSummary] = useState(false);

  return (
    <div className="w-full text-slate-900 font-sans animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Recruiter Header (Candidate Info) */}
        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              Candidate Information
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{candidate.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-semibold text-slate-500">
              <span>Session ID: <span className="font-mono text-slate-800 font-bold">{sessionId || 'N/A'}</span></span>
              <span>•</span>
              <span>Applied Role: <span className="text-slate-800 font-bold">{candidate.role} Branch</span></span>
              <span>•</span>
              <span>Date: <span className="text-slate-800 font-bold">{new Date().toLocaleDateString()}</span></span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border bg-indigo-50 text-indigo-700 border-indigo-200">
                ⚡ Configured Mode: {String(candidate.session?.configured_evaluation_mode || candidate.session?.evaluation_mode || report.metadata?.evaluationMode || (report.metadata as any)?.mode || 'LOCAL').toUpperCase()}
              </span>
            </div>
          </div>
          <Logo className="w-10 h-10 opacity-70" />
        </header>

        {/* Phase 4: Distinct Configuration and Execution Metadata Panels */}
        {candidate.session && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-indigo-600" /> Evaluation Configuration
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Configured Mode</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.configured_evaluation_mode || candidate.session.evaluation_mode || (report.metadata as any)?.evaluationMode || 'API'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Provider</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.configured_provider || (report.metadata as any)?.provider || 'OpenRouter'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Model</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.configured_model || (report.metadata as any)?.model || 'openrouter/free'}</span>
                </div>
              </div>
            </section>

            <section className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert size={14} className="text-emerald-600" /> Execution Tracking
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Execution Status</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.execution_status || 'REPORT_SAVED'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Attempt Mode</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.execution_attempt_mode || candidate.session.configured_evaluation_mode || candidate.session.evaluation_mode || 'API'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Final Source</span>
                  <span className="text-sm font-black text-slate-700">{candidate.session.final_report_source || candidate.session.evaluation_mode || 'API'}</span>
                </div>
                {candidate.session.fallback_mode && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1"><AlertTriangle size={12}/> Fallback Used</span>
                    <span className="text-sm font-black text-amber-700">{candidate.session.fallback_mode}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {terminationWarningBanner}

        {/* Hiring Decision Panel */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hiring Decision</h3>
            <span className="text-[10px] text-slate-400 font-semibold italic">Should I hire this candidate?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Primary Rating Ring */}
            <div className="md:col-span-4 flex flex-col items-center justify-center text-center py-2 border-r border-slate-100 pr-0 md:pr-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Overall Interview Score</span>
              <div className="relative flex items-center justify-center">
                <ScoreRing score={trustAdjustedScore} size={135} />
                <div className="absolute text-center">
                  <span className="text-2xl font-black text-slate-800">{isProcessing ? '--' : `${trustAdjustedScore}%`}</span>
                  <span className="text-[10px] text-slate-450 font-bold block mt-0.5">{isProcessing ? 'Pending' : 'Trust adjusted'}</span>
                </div>
              </div>
            </div>

            {/* Verdict Rationale & Breakdown */}
            <div className="md:col-span-8 space-y-4">
              {isProcessing && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <Loader2 className="animate-spin text-amber-500 mt-0.5 shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">AI Evaluation In Progress</h4>
                    <p className="text-xs text-amber-700 mt-1 font-semibold leading-relaxed">
                      Local fallback evaluation is currently shown. The final AI evaluation and hiring recommendation will update automatically once background processing completes.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Recommendation:</span>
                <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${isProcessing ? 'bg-slate-100 text-slate-500 border-slate-200' : hiringColors[verdict]}`}>
                  {verdict}
                </span>
                {isInsufficientEvidence && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-rose-650 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full uppercase">
                    <AlertTriangle size={10} /> Insufficient Evidence
                  </span>
                )}
              </div>

              {report.executiveSummary?.summary && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <p className="text-xs text-slate-655 font-semibold leading-relaxed">
                    {report.executiveSummary.summary}
                  </p>
                </div>
              )}

              {/* Expandable score breakdown dropdown */}
              <div className="border border-slate-150 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRecruiterScoreBreakdown(!showRecruiterScoreBreakdown)}
                  className="w-full bg-slate-50 px-4 py-3 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span>▼ Evaluation Breakdown</span>
                  {showRecruiterScoreBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                
                {showRecruiterScoreBreakdown && (
                  <div className="p-4 border-t border-slate-150 space-y-3 bg-white animate-in fade-in duration-200">
                    <MetricBar label="Knowledge Score" value={overallKnowledge / 10} />
                    <MetricBar label="Reasoning Score" value={overallReasoning / 10} />
                    <MetricBar label="Communication" value={overallCommunication / 10} />
                    <MetricBar label="Readiness Score" value={(report.executiveSummary?.readinessScore ?? report.overallScores?.readinessScore ?? 0) / 10} />
                    <MetricBar label="Reliability Score" value={reliabilityScore / 10} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Recruiter Review Panel (Human Decision & Audit Override) */}
        {mode === 'admin' && (
          <section className="bg-linear-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md space-y-4 border border-indigo-900/50">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
  <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
    <Scale size={16} /> Recruiter Review & Decision Audit
  </h3>
  <span className="text-[10px] text-indigo-200 font-semibold italic">Human-in-the-loop oversight</span>
</div>

{outcome === 'PENDING' ? (
  /* ── BEFORE DECISION: show full two-column panel ── */
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Left — AI vs Human comparison */}
    <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 font-medium">AI Recommendation:</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-700 text-slate-200 uppercase">
          {verdict}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 font-medium">Human Recruiter Decision:</span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-md uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
          PENDING
        </span>
      </div>
    </div>

    {/* Right — action buttons */}
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-300">Submit Decision:</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isSaving}
          onClick={() => handleSaveDecision('SHORTLIST')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-800 text-emerald-400 hover:bg-slate-700">
          Shortlist
        </button>
        <button type="button" disabled={isSaving}
          onClick={() => handleSaveDecision('REJECT')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-800 text-rose-400 hover:bg-slate-700">
          Reject
        </button>
        <button type="button" disabled={isSaving}
          onClick={() => handleSaveDecision('INTERVIEW_SCHEDULED')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-800 text-indigo-300 hover:bg-slate-700">
          Schedule Next Round
        </button>
      </div>
      <input
        type="text"
        placeholder="Optional reviewer notes..."
        value={reviewerNotes}
        onChange={(e) => setReviewerNotes(e.target.value)}
        className="w-full bg-slate-800/80 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-indigo-400 transition-colors"
      />
    </div>
  </div>
) : (
  /* ── AFTER DECISION: collapse to single confirmation block ── */
  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
    <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">
      <Check size={14} /> Decision Recorded
    </p>
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400">AI Recommendation:</span>
      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-700 text-slate-200 uppercase">{verdict}</span>
      {wasOverridden && (
        <span className="text-xs font-bold text-rose-300 flex items-center gap-1">
          <AlertCircle size={12} /> Overridden
        </span>
      )}
    </div>
    <p className="text-xs text-slate-300">
      This candidate has been marked as{' '}
      <span className={`font-bold uppercase ${
        outcome === 'SHORTLIST' ? 'text-emerald-400' :
        outcome === 'REJECT' ? 'text-rose-400' :
        'text-indigo-300'
      }`}>
        {outcome.replace('_', ' ')}
      </span>.
      {reviewerNotes && (
        <span className="block mt-1 text-slate-400 italic">Note: {reviewerNotes}</span>
      )}
    </p>
    <button
      type="button"
      onClick={() => setOutcome('PENDING')}
      className="text-[10px] font-bold text-slate-400 hover:text-white underline underline-offset-2 transition-colors"
    >
      Change decision
    </button>
  </div>
)}
</section>
        )}
        {/* Interview Timeline Panel */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interview Timeline</h3>
            <span className="text-[10px] text-slate-400 font-semibold italic">Did anything unusual happen?</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Interview Started</span>
              <span className="text-xs font-bold text-slate-750 block mt-1">Session Initiated</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Interview Completed</span>
              <span className="text-xs font-bold text-slate-750 block mt-1">
                {isTerminatedEarly ? 'Early Stop' : 'Full Session'}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Duration</span>
              <span className="text-xs font-bold text-slate-750 block mt-1">{formatDuration(durationSeconds)}</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Interview Status</span>
              <span className={`inline-block mt-1 text-[10px] font-black uppercase tracking-wider ${
                interviewStatus === 'Completed' ? 'text-emerald-700' : 'text-rose-700 font-bold'
              }`}>
                {interviewStatus}
              </span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Warnings Issued</span>
              <span className={`text-xs font-bold block mt-1 ${
                (report.proctoringSummary?.warningsIssued ?? 0) > 0 ? 'text-rose-600 font-bold' : 'text-slate-750'
              }`}>
                {report.proctoringSummary?.warningsIssued ?? 0}
              </span>
            </div>
          </div>
        </section>

        {/* Interview Trust Panel */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interview Trust</h3>
            <span className="text-[10px] text-slate-400 font-semibold italic">Can I trust the interview?</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Overall Trust Verdict</span>
              <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                integrityVerdictRecruiter === 'Trusted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-250'
              }`}>
                {integrityVerdictRecruiter}
              </span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Integrity Score</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{integrityScore}%</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Reliability Score</span>
              <span className="text-lg font-black text-slate-800 mt-1 block">{reliabilityScore}%</span>
            </div>
          </div>

          {/* Follow-up Questions count */}
          <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-2xl">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-indigo-850 uppercase tracking-wider">Follow-up Audits Done</span>
              <span className="bg-indigo-100 text-indigo-750 px-2.5 py-0.5 rounded-full">{report.validationResults?.length ?? 0} Asked</span>
            </div>
          </div>

          {/* Risks & Warnings Block (Check 3 - Only render small green badges if no risks) */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Detected Risks & Calibration</span>
            
            <div className="flex flex-wrap gap-2">
              {/* Contradictions Badge / List */}
              {report.contradictions && report.contradictions.length > 0 ? (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-red-50 text-red-700 border-red-200`}>
                  ⚠️ {contradictionsCount} Contradictions Detected
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-250">
                  ✓ No contradictions detected
                </span>
              )}

              {/* Misconceptions Badge */}
              {misconceptionsCount > 0 ? (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-rose-50 text-rose-700 border-rose-200`}>
                  ⚠️ {misconceptionsCount} Potential Conceptual Misunderstandings
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-250">
                  ✓ No misconceptions detected
                </span>
              )}

              {/* Confidence Calibration */}
              {hasConfidenceMismatch ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200">
                  ⚠️ Confidence Gap: {confGap > 0 ? 'Overconfident' : 'Underconfident'}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-250">
                  ✓ Confidence Calibrated
                </span>
              )}
            </div>

            {/* Render contradictions details list if they exist */}
            {report.contradictions && report.contradictions.length > 0 && (
              <div className="bg-red-50/20 border border-red-100 rounded-xl p-3.5 space-y-2 mt-2">
                <span className="text-[10px] font-black text-red-650 uppercase block">Technical Discrepancies Details</span>
                <ul className="space-y-1.5 text-xs text-slate-700 leading-normal">
                  {report.contradictions.map((item, cIdx) => (
                    <li key={cIdx} className="flex gap-2 items-start font-medium">
                      <span className="text-red-500 font-bold">•</span>
                      <span>
                        <strong className="text-slate-800">Q#{item.qIndex1} vs Q#{item.qIndex2} ({item.severity} severity):</strong> {item.explanation}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Validation comparative results table if follow-ups happened */}
          {report.validationResults && report.validationResults.length > 0 && (
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Follow-up Validation Log</span>
              
              <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-[9px] font-bold text-slate-450 uppercase">
                    <tr>
                      <th className="px-3 py-2">Parent Question Score</th>
                      <th className="px-3 py-2">Follow-up Score</th>
                      <th className="px-3 py-2">Collapse Value</th>
                      <th className="px-3 py-2">Reliability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-655">
                    {report.validationResults.map((item, vIdx) => {
                      const collapse = Math.max(0, item.parentScore - item.followupScore);
                      return (
                        <tr key={vIdx}>
                          <td className="px-3 py-2">{item.parentScore}/10</td>
                          <td className="px-3 py-2">{item.followupScore}/10</td>
                          <td className={`px-3 py-2 font-bold ${collapse > 2 ? 'text-rose-650' : 'text-slate-600'}`}>
                            -{collapse.toFixed(1)} pts
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              item.reliability >= 80 ? 'bg-emerald-50 text-emerald-700' :
                              item.reliability >= 50 ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>
                              {item.reliability}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Proctor Detail log dropdown */}
          <div className="border border-slate-150 rounded-xl overflow-hidden mt-3">
            <button
              type="button"
              onClick={() => setShowProctorSummary(!showProctorSummary)}
              className="w-full bg-slate-50 px-4 py-3 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>▼ Proctor Summary</span>
              {showProctorSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {showProctorSummary && (
              <div className="p-4 border-t border-slate-150 grid grid-cols-2 md:grid-cols-5 gap-4 bg-white animate-in fade-in duration-200">
                <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-bold text-slate-450 uppercase block">Tab Switches</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.tabSwitches ?? 0}</span>
                </div>
                <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-bold text-slate-450 uppercase block">Camera Away</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.faceAwayEvents ?? 0}</span>
                </div>
                <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-bold text-slate-450 uppercase block">Multiple Person</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.multiplePersonEvents ?? 0}</span>
                </div>
                <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-bold text-slate-450 uppercase block">Gaze Duration</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">
                    {report.proctoringSummary?.totalGazeAwayDurationMs !== undefined 
                      ? `${(report.proctoringSummary.totalGazeAwayDurationMs / 1000).toFixed(1)}s` 
                      : "0.0s"}
                  </span>
                </div>
                <div className="p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                  <span className="text-[9px] font-bold text-slate-450 uppercase block">Warnings</span>
                  <span className="text-base font-black text-slate-800 mt-0.5 block">{report.proctoringSummary?.warningsIssued ?? 0}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Question Breakdown */}
        <section className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-3">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <MessageSquare size={20} className="text-indigo-650" /> Question Breakdown
            </h2>
            <span className="text-[10px] text-slate-400 font-semibold italic">Why did the AI reach this decision?</span>
          </div>
          <div className="space-y-4">
            {report.questionBreakdown && report.questionBreakdown.length > 0 ? (
              report.questionBreakdown.map((item, idx) => (
                <QuestionCard key={idx} item={item} index={idx} mode="admin" />
              ))
            ) : (
              <p className="text-xs font-medium text-slate-400 italic">No question breakdown available.</p>
            )}
          </div>
        </section>

        {/* Final Recommendation Card (Screenshot-ready Footer) */}
        <section className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-6 border border-slate-850">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-lg font-black tracking-tight">Final Recommendation</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">What should I do next?</p>
            </div>
            <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${
              verdict === 'Strong Hire' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
              verdict === 'Hire' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' :
              verdict === 'Consider' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
              'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {verdict}
            </span>
          </div>

          <div className="space-y-4 text-sm font-semibold text-slate-300">
            {/* Why (Rationale) */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Why</span>
              <p className="text-slate-200 mt-1 leading-relaxed text-xs">
                {report.executiveSummary?.summary || 'Consistent candidate capability profile completed.'}
              </p>
            </div>

            <hr className="border-slate-800" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Strengths</span>
                <ul className="space-y-1 text-xs">
                  {report.strengths && report.strengths.length > 0 ? (
                    report.strengths.slice(0, 3).map((str, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-emerald-300">
                        <span className="font-bold">•</span>
                        <span>{str}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">No specific strengths mapped.</li>
                  )}
                </ul>
              </div>

              {/* Concerns */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Concerns</span>
                <ul className="space-y-1 text-xs">
                  {report.weaknesses && report.weaknesses.length > 0 ? (
                    report.weaknesses.slice(0, 3).map((weak, idx) => (
                      <li key={idx} className="flex gap-2 items-start text-rose-300">
                        <span className="font-bold">•</span>
                        <span>{weak}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-500 italic">No significant concerns highlighted.</li>
                  )}
                </ul>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Hiring Risks */}
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Hiring Risks</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                  integrityScore < 70 || contradictionsCount > 1 || report.overallScores?.bluffRisk === 'HIGH'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : integrityScore < 85 || contradictionsCount > 0 || report.overallScores?.bluffRisk === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {integrityScore < 70 || contradictionsCount > 1 || report.overallScores?.bluffRisk === 'HIGH' ? 'High Risk' :
                   integrityScore < 85 || contradictionsCount > 0 || report.overallScores?.bluffRisk === 'MEDIUM' ? 'Medium Risk' :
                   'Low Risk'}
                </span>
                <p className="text-slate-400 text-xs font-medium">
                  {integrityScore < 70 ? 'Integrity score triggers validation alerts.' :
                   contradictionsCount > 0 ? 'Technical contradictions detected in evaluation transcripts.' :
                   'Guidelines fully respected during session.'}
                </p>
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* Next Steps */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-1">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Next Step</span>
                <span className="text-sm font-black text-white mt-1 block">
                  {verdict === 'Strong Hire' || verdict === 'Hire' ? 'Proceed to Technical Round 2' :
                   verdict === 'Consider' ? 'Assign Take-home Assessment' :
                   'Reject Application'}
                </span>
              </div>
              
              {onHome && (
                <button
                  type="button"
                  onClick={onHome}
                  className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs shrink-0 self-start sm:self-center"
                >
                  <ArrowLeft size={14} /> Return to Dashboard
                </button>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
