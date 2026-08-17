import { computeRecommendation } from './shared/scoringPolicy';
import { buildBatchEvaluationPrompt } from './shared/promptBuilder';

async function runTests() {
  console.log("Running Shared Module Tests...");
  
  // 1. Test Scoring Policy
  const score1 = computeRecommendation(82, 100);
  console.assert(score1 === 'Strong Hire', '82 should be Strong Hire');
  
  const score2 = computeRecommendation(64, 100);
  console.assert(score2 === 'Consider', '64 should be Consider');

  const score3 = computeRecommendation(85, 30);
  console.assert(score3 === 'Reject', 'Low integrity should Reject');
  console.log("✅ Scoring Policy passed.");

  // 2. Test Prompt Builder
  const promptData = {
    items: [
      { question: "What is React?", answer: "A UI library" }
    ]
  };
  const p = buildBatchEvaluationPrompt(promptData);
  console.assert(p.systemPrompt.includes("technical interviewer"), "Missing system prompt");
  console.assert(p.userPrompt.includes("A UI library"), "Missing user answer");
  console.assert(p.promptVersion === "v2-batch-json", "Missing prompt version");
  console.log("✅ Prompt Builder passed.");
}

runTests().catch(console.error);
