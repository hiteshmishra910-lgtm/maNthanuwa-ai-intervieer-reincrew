import os
import json
import random
import time
import gevent
import numpy as np
from locust import HttpUser, task, between, events
from locust.runners import WorkerRunner
from locust.exception import StopUser

def load_env(filepath):
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    if k not in os.environ:
                        os.environ[k] = v.strip().strip("'\"")

# Load environment configuration
load_env("performance-tests/config.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

FAST_LOAD_MODE = os.getenv("FAST_LOAD_MODE", "false").lower() == "true"
MOCK_AI_RESPONSE = os.getenv("MOCK_AI_RESPONSE", "false").lower() == "true"
MOCK_DB_WRITE = os.getenv("MOCK_DB_WRITE", "false").lower() == "true"

AI_INPUT_COST_PER_MILLION = float(os.getenv("AI_INPUT_COST_PER_MILLION", "0.14"))
AI_OUTPUT_COST_PER_MILLION = float(os.getenv("AI_OUTPUT_COST_PER_MILLION", "0.28"))

TEST_STAGE = os.getenv("TEST_STAGE", "default")

# Global Concurrency Counters & Metrics
active_ai_requests = 0
peak_ai_requests = 0

global_ai_requests = 0
global_ai_429s = 0
global_ai_402s = 0  # Free-tier exhaustion tracker

# Financial & Token Tracking
total_ai_calls = 0
total_input_tokens = 0
total_output_tokens = 0
total_ai_cost = 0.0

# Completed interview counter (for per-interview tracking)
completed_interviews_count = 0

# Per-AI-Call Detailed Log (for pinpointing free-tier exhaustion)
# Each entry: {"call_num": int, "interview_num": int, "call_type": str, "status": str, "http_code": int, "latency_ms": float, "timestamp": float}
ai_call_log = []

# Failure Classifications
supabase_failures = {
    401: 0,
    402: 0,
    403: 0,
    404: 0,
    409: 0,
    429: 0,
    500: 0,
    502: 0,
    503: 0,
    504: 0,
    "other": 0
}

# Completed Interview Durations (in seconds)
completed_interview_durations = []

# Mock Candidate Q&A Bank
CANDIDATE_FLOW_DATA = [
    {
        "id": 1,
        "question": "Explain what is normalization in DBMS and why we use it.",
        "difficulty": "medium",
        "ideal_answer": "Normalization is the process of organizing data in a database to reduce redundancy and improve data integrity. It involves creating tables and establishing relationships based on rules like 1NF, 2NF, and 3NF to avoid insertion, update, and deletion anomalies.",
        "evaluationGuide": ["Normalization definition", "Redundancy reduction", "Data integrity", "Insertion/Update/Deletion anomalies"],
        "answer": "Normalization is the process of organizing tables in a database to reduce data redundancy. By splitting large tables into smaller ones and setting relationships between them, we ensure data integrity and avoid anomalies like update or delete problems. We use normal forms like First, Second, and Third normal form to achieve this structure.",
        "type": "Technical"
    },
    {
        "id": 2,
        "question": "What is the difference between a process and a thread in OS?",
        "difficulty": "medium",
        "ideal_answer": "A process is an independent execution unit with its own memory space, whereas a thread is a lightweight execution unit within a process that shares the parent process's memory and resources. Processes are isolated, while threads share variables but risk corruption if not synchronized.",
        "evaluationGuide": ["Process definition", "Thread definition", "Memory space allocation", "Resource sharing/Isolation", "Synchronization risk"],
        "answer": "A process represents a program in execution and has its own dedicated memory space, making it isolated from other programs. A thread is a lightweight unit of execution within a process. Multiple threads share the process's memory and resources, making communication faster, but requiring synchronization to prevent data race conditions.",
        "type": "Technical"
    },
    {
        "id": 3,
        "question": "Explain the difference between TCP and UDP protocols.",
        "difficulty": "medium",
        "ideal_answer": "TCP is a connection-oriented protocol that ensures reliable delivery of data packets through handshakes, sequencing, and error checking. UDP is connectionless and sends packets without verification, which makes it faster but unreliable.",
        "evaluationGuide": ["TCP connection-oriented", "UDP connectionless", "Reliability/Handshakes in TCP", "Speed vs reliability trade-off", "Use cases"],
        "answer": "TCP is connection-oriented and requires a three-way handshake before transmitting data. It guarantees data arrives in order without errors using acknowledgements and retransmissions, making it reliable. UDP is connectionless and sends packets directly without any guarantee of arrival, making it faster and ideal for video streaming or gaming where minor loss is okay.",
        "type": "Technical"
    },
    {
        "id": 4,
        "question": "Describe a challenging project you worked on. What was your role and how did you overcome the obstacles?",
        "difficulty": "medium",
        "ideal_answer": "Candidate defines problem, their specific action, and a positive result.",
        "evaluationGuide": ["Problem definition", "Action taken", "Result"],
        "answer": "I worked on a web portal where the dashboard took over 5 seconds to load. As the backend developer, I profiled the queries and found multiple nested joins. I added composite indexes, cached static data using Redis, and optimized database queries, reducing the load time to 800 milliseconds.",
        "type": "Behavioral Experience"
    },
    {
        "id": 5,
        "question": "How do you handle disagreements with colleagues or managers?",
        "difficulty": "medium",
        "ideal_answer": "Seeks to understand, communicates respectfully, finds compromise.",
        "evaluationGuide": ["Communication", "Respect", "Compromise"],
        "answer": "I handle disagreements by scheduling a brief one-on-one session to discuss both perspectives calmly. I focus on data-driven reasoning rather than personal bias, try to understand their concerns, and look for a middle-ground solution or compromise that best aligns with project and company goals.",
        "type": "Behavioral Situation"
    }
]

# Exact Production Prompts
SCORING_GUIDELINES = """SCORING GUIDELINES (IMPORTANT):

1. GROWTH-ORIENTED SCORING BANDS (RECALIBRATED):
    * Exceptional (9-10/10): Candidates showing deep, flawless understanding with practical nuance.
    * Strong candidate (8-9/10): Good understanding, depth, and details.
    * Industry-ready fundamentals (6-7/10): Award this range if the candidate demonstrates genuine basic understanding of the concepts with minor gaps (do not penalize average answers down to 4-5).
    * Early learner (4-5/10): Shows basic, limited, or partial credit.
    * Very weak understanding (0-3/10): Significant inaccuracies, empty answers, or pure guess/bluff.
2. CONCEPT OVER KEYWORDS:
    If the candidate demonstrates correct conceptual understanding in their own words, award reasonable marks even if exact keywords or textbook terminology are missing.
3. REAL-WORLD INTERVIEW STANDARD:
    Evaluate like an experienced interviewer, not an exam checker. Candidates may use simple language, informal phrasing, or imperfect grammar while still demonstrating understanding.
4. LEARNING POTENTIAL RUBRIC:
    Evaluate:
    - Curiosity: Does the candidate show an interest in details, edge cases, or broader context?
    - Reasoning: Can they trace logic and derive answers systematically?
    - Self-Correction: Do they acknowledge gaps or self-correct when realizing mistakes?
5. AVOID OVER-PENALIZATION:
    Minor omissions, communication mistakes, stuttering, or imperfect wording should not significantly reduce scores if the core concept is correct.

Maintain evidence-based evaluation, but do not be excessively strict when the candidate demonstrates genuine conceptual understanding."""

EVALUATION_PROMPT = """You are evaluating a SPOKEN interview answer (transcribed via speech-to-text).
IMPORTANT: The transcript may contain minor speech errors, informal phrasing, or filler words. Focus on the SUBSTANCE of what was said, not grammar or polish.

QUESTION: "{question}"
IDEAL/REFERENCE ANSWER: "{ideal_answer}"
TYPE: {type}

EVALUATION GUIDE CHECKLIST AREAS TO CHECK:
{guideStr}

CANDIDATE'S SPOKEN ANSWER: "{answer}"

{scoringGuidelines}

INTERNAL RUBRICS (Aligned with Scoring Calibration):
- Coverage:
  8-10 = Explains almost all expected checklist areas correctly, showing clear coverage.
  6-8 = Explains most expected checklist areas, with minor gaps or omission of non-critical details.
  4-6 = Explains some expected checklist areas correctly (partial credit), showing partial coverage.
  2-4 = Only mentions or superficially covers areas without explaining them (limited coverage).
  0-2 = No relevant areas mentioned or answered.
- Understanding:
  8-10 = Explains core ideas in their own words clearly with examples, showing excellent understanding.
  6-8 = Demonstrates good understanding, can explain key details but has minor gaps.
  4-6 = Shows partial understanding, understands basic terms but struggles to explain deeply.
  2-4 = Superficial mentions or copy-pasted terms without explaining what they mean.
  0-2 = Incorrect information or total misunderstanding of the concept.
- Reasoning:
  8-10 = Core reasoning is solid, logical, and supports design choices or tradeoffs.
  6-8 = Clear reasoning with minor logical gaps or incomplete pros/cons.
  4-6 = Partial reasoning, some logic is present but has notable holes.
  2-4 = Limited logical connection, unstructured or vague logic.
  0-2 = Confused reasoning, technical contradictions, or irrelevant logic.
- Depth:
  8-10 = Provides excellent detail and nuance; explains design tradeoffs, examples, or practical applications.
  6-8 = Substantial detail and context provided, but misses some advanced nuances.
  4-6 = Basic details provided; answers the question directly but lacks elaboration.
  2-4 = Very surface-level, lists keywords without elaboration.
  0-2 = No depth, incorrect assertions, or empty answer.

CRITICAL RULE ON KEYWORD LISTING / SHORT UNEXPLAINED ANSWERS:
If the candidate's answer simply lists the names of the expected areas or keywords without actually explaining what they mean, how they function, or giving any context/examples, the answer is NOT complete.
In this case, you MUST penalize the scores strictly:
- "conceptUnderstanding" MUST NOT exceed 2/10.
- "depth" MUST NOT exceed 1/10.
- "reasoning" MUST NOT exceed 2/10.
- "accuracy" and "conceptCoverage" MUST NOT exceed 4/10.
- State in the "feedback" that the candidate only listed the concepts without explaining them.

Evaluate the candidate's answer against the expected checklist areas and rubrics.
Check for any hallucinated, factually incorrect, or contradictory technical statements and return them as technicalErrors with severity (low, medium, or high).
Provide score for answerDirectnessScore (0-10) which measures how directly they answered the question without keyword stuffing or bluffing.
Provide tradeoffReasoningScore (0-10 or null) which evaluates how well they discuss design tradeoffs, pros/cons, or alternative approaches (return null if not applicable to this question).

EVALUATE EVIDENCE OF POSITIVE MOMENTS:
Set the following positiveEvidence flags to true if the candidate explicitly demonstrates:
- strongExample: provides a clear, valid real-world example or code demonstration.
- realProject: mentions a concrete professional/academic project they worked on related to this topic.
- tradeoffDiscussion: explicitly discusses pros/cons, design tradeoffs, or alternatives.
- practicalExperience: references hands-on practical troubleshooting, deployment, or execution.

Return strictly the following JSON structure:
{{
  "accuracy": number, // 0-10
  "conceptCoverage": number, // 0-10
  "conceptUnderstanding": number, // 0-10
  "reasoning": number, // 0-10
  "depth": number, // 0-10
  "clarity": number, // 0-10
  "structure": number, // 0-10
  "confidence": number, // 0-10
  "consistency": number, // 0-10
  "answerDirectnessScore": number, // 0-10
  "tradeoffReasoningScore": number | null, // 0-10 or null
  "curiosity": number, // 0-10
  "selfCorrection": number, // 0-10
  "technicalErrors": [
    {{ "error": "description of incorrect or hallucinated statement", "severity": "low" | "medium" | "high" }}
  ],
  "positiveEvidence": {{
    "strongExample": boolean,
    "realProject": boolean,
    "tradeoffDiscussion": boolean,
    "practicalExperience": boolean
  }},
  "matchedKeyPoints": ["normalization", "redundancy"],
  "missingKeyPoints": ["anomalies"],
  "feedback": "2-sentence objective, evidence-based feedback focusing strictly on the candidate's response."
}}"""

FOLLOWUP_PROMPT = """You are an expert interviewer. The candidate has answered a technical question.
Generate a short follow-up question to validate their depth of understanding or detect if they are bluffing.
The follow-up question MUST be at the same difficulty level ("{difficulty}").

Parent Question: "{question}"
Candidate's Answer: "{answer}"

Return strictly the following JSON structure:
{{
  "id": "followup_{parent_id}",
  "question": "<follow-up question text>",
  "category": "{category}",
  "type": "Technical",
  "difficulty": "{difficulty}",
  "evaluationGuide": [
    "<specific expected evaluation area 1>",
    "<specific expected evaluation area 2>"
  ]
}}"""

CONTRADICTION_PROMPT = """You are evaluating a candidate's technical responses in an interview for contradictions.
Only look for actual direct technical contradictions between answers, ignoring subjective, behavioral, or personal statements.
For example, if in one answer they say "Java is pass-by-reference" and in another they say "Java is pass-by-value", that is a high-severity confirmed contradiction.
Do not flag minor phrasing variations as contradictions.

TRANSCRIPTS TO EVALUATE:
{transcripts}

Return strictly the following JSON structure:
{{
  "crossQuestionContradictions": [
    {{
      "qIndex1": number,
      "qIndex2": number,
      "explanation": "detailed explanation of why these two answers contradict",
      "severity": "low" | "medium" | "high",
      "status": "confirmed" | "possible" | "insufficient_evidence",
      "confidence": number
    }}
  ]
}}"""


def track_ai_usage(prompt, response_text, response_json=None):
    global total_ai_calls, total_input_tokens, total_output_tokens, total_ai_cost
    
    total_ai_calls += 1
    prompt_tokens = 0
    completion_tokens = 0
    
    if response_json and "usage" in response_json:
        prompt_tokens = response_json["usage"].get("prompt_tokens", 0)
        completion_tokens = response_json["usage"].get("completion_tokens", 0)
        
    if prompt_tokens == 0:
        # 1 word ≈ 1.33 tokens
        prompt_tokens = int(len(prompt.split()) * 1.33)
    if completion_tokens == 0:
        completion_tokens = int(len(response_text.split()) * 1.33)
        
    total_input_tokens += prompt_tokens
    total_output_tokens += completion_tokens
    
    cost = (prompt_tokens / 1000000.0 * AI_INPUT_COST_PER_MILLION) + (completion_tokens / 1000000.0 * AI_OUTPUT_COST_PER_MILLION)
    total_ai_cost += cost


class ReincrewUser(HttpUser):
    # If FAST_LOAD_MODE is enabled, think time is bypassed (set to 0)
    # Otherwise, it simulates 20-60 seconds between questions
    wait_time = between(0, 0) if FAST_LOAD_MODE else between(20, 60)
    
    def on_start(self):
        global completed_interviews_count
        completed_interviews_count += 1
        self.interview_number = completed_interviews_count
        
        self.candidate_name = f"locust_test_{random.randint(1000, 9999)}_{int(time.time() * 1000)}"
        self.candidate_email = f"{self.candidate_name}@example.com"
        self.candidate_id = None
        self.session_id = None
        self.job_post_id = None
        self.transcripts_history = []
        self.interview_start_time = time.time()
        self.ai_call_count_local = 0  # per-interview AI call counter
        
        self.supabase_headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        }
        
    def log_supabase_failure(self, status_code):
        global supabase_failures
        code = status_code if status_code in supabase_failures else "other"
        supabase_failures[code] += 1

    def call_supabase(self, method, path, json_data=None, headers=None, name=None):
        if MOCK_DB_WRITE and method in ["POST", "PATCH", "PUT"]:
            # Bypass DB writes for DB-Mocking (AI Only profile)
            sleep_time = random.uniform(0.010, 0.035)  # Simulate 10-35ms DB response time
            time.sleep(sleep_time)
            events.request.fire(
                request_type="MockDB",
                name=f"[MOCK] {name or path}",
                response_time=sleep_time * 1000,
                response_length=100,
                exception=None
            )
            
            # Return dummy payloads matching Supabase representations
            if path.startswith("/rest/v1/candidates"):
                return [{"id": f"mock-cand-{random.randint(1000,9999)}"}]
            elif path.startswith("/rest/v1/interview_sessions") and method == "POST":
                return [{"id": f"mock-sess-{random.randint(1000,9999)}"}]
            return []

        url = f"{SUPABASE_URL}{path}"
        req_headers = {**self.supabase_headers}
        if headers:
            req_headers.update(headers)
            
        with self.client.request(method, url, json=json_data, headers=req_headers, name=name, catch_response=True) as response:
            if 200 <= response.status_code < 300:
                response.success()
                try:
                    return response.json()
                except Exception:
                    return None
            else:
                self.log_supabase_failure(response.status_code)
                response.failure(f"Supabase error {response.status_code}: {response.text}")
                return None

    def call_openrouter(self, prompt, name):
        global active_ai_requests, peak_ai_requests, global_ai_requests, global_ai_429s, global_ai_402s, ai_call_log
        
        global_ai_requests += 1
        self.ai_call_count_local += 1
        call_start = time.time()
        
        # Gevent-safe counter increment
        active_ai_requests += 1
        peak_ai_requests = max(peak_ai_requests, active_ai_requests)
        
        mock_response_val = {
            "accuracy": 8,
            "conceptCoverage": 8,
            "conceptUnderstanding": 8,
            "reasoning": 7,
            "depth": 7,
            "clarity": 8,
            "structure": 8,
            "confidence": 8,
            "consistency": 8,
            "answerDirectnessScore": 9,
            "tradeoffReasoningScore": 8,
            "curiosity": 7,
            "selfCorrection": 6,
            "technicalErrors": [],
            "positiveEvidence": {
                "strongExample": True,
                "realProject": False,
                "tradeoffDiscussion": True,
                "practicalExperience": False
            },
            "matchedKeyPoints": ["normalization", "integrity"],
            "missingKeyPoints": ["anomalies"],
            "feedback": "Answer explains the concepts effectively with good technical depth.",
            "crossQuestionContradictions": [],
            "id": f"mock-fu-{random.randint(100,999)}",
            "question": "Can you explain how transitive dependencies affect Third Normal Form (3NF)?",
            "category": "Database",
            "type": "Technical",
            "difficulty": "medium",
            "evaluationGuide": ["transitive dependency", "superkey"]
        }
        
        try:
            if MOCK_AI_RESPONSE:
                # Sleep to simulate actual LLM latency (800ms - 1500ms)
                sleep_time = random.uniform(0.8, 1.5)
                time.sleep(sleep_time)
                
                events.request.fire(
                    request_type="MockAI",
                    name=f"[MOCK] {name}",
                    response_time=sleep_time * 1000,
                    response_length=150,
                    exception=None
                )
                
                response_text = json.dumps(mock_response_val)
                track_ai_usage(prompt, response_text)
                return mock_response_val
            else:
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "Reincrew AI Locust Load Test"
                }
                
                payload = {
                    "model": "deepseek/deepseek-chat",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1000
                }
                
                with self.client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers, name=name, catch_response=True) as response:
                    call_latency = (time.time() - call_start) * 1000
                    
                    if response.status_code == 200:
                        response.success()
                        # Log successful call
                        ai_call_log.append({
                            "call_num": global_ai_requests,
                            "interview_num": self.interview_number,
                            "call_type": name,
                            "status": "SUCCESS",
                            "http_code": 200,
                            "latency_ms": round(call_latency, 1),
                            "timestamp": time.time()
                        })
                        content = ""
                        try:
                            res_json = response.json()
                            content = res_json["choices"][0]["message"]["content"]
                            track_ai_usage(prompt, content, res_json)
                            
                            # Clean markdown code fences if present
                            cleaned = content.strip()
                            if cleaned.startswith("```"):
                                lines = cleaned.splitlines()
                                if len(lines) > 2 and (lines[0].startswith("```json") or lines[0].startswith("```")):
                                    cleaned = "\n".join(lines[1:-1])
                                else:
                                    cleaned = cleaned.replace("```json", "").replace("```", "")
                            cleaned = cleaned.strip()
                            
                            return json.loads(cleaned)
                        except Exception as e:
                            original_content = content[:200] if 'content' in locals() else 'None'
                            response.failure(f"JSON parsing error: {str(e)}. Original Content: {original_content}")
                            return mock_response_val
                    else:
                        # Log failed call with details
                        ai_call_log.append({
                            "call_num": global_ai_requests,
                            "interview_num": self.interview_number,
                            "call_type": name,
                            "status": f"FAILED_{response.status_code}",
                            "http_code": response.status_code,
                            "latency_ms": round(call_latency, 1),
                            "timestamp": time.time(),
                            "error_snippet": response.text[:200] if response.text else ""
                        })
                        if response.status_code == 429:
                            global_ai_429s += 1
                        elif response.status_code == 402:
                            global_ai_402s += 1
                            print(f"\n[FREE-TIER EXHAUSTED] 402 Payment Required at AI Call #{global_ai_requests}, Interview #{self.interview_number}, Call Type: {name}")
                        response.failure(f"OpenRouter Error {response.status_code}: {response.text}")
                        return mock_response_val
        finally:
            # Gevent-safe counter decrement
            active_ai_requests -= 1

    @task
    def run_candidate_lifecycle(self):
        # 1. Login Candidate
        candidate_payload = {
            "name": self.candidate_name,
            "email": self.candidate_email,
            "applied_role": "CSE"
        }
        res_cand = self.call_supabase(
            "POST", 
            "/rest/v1/candidates?on_conflict=email", 
            json_data=candidate_payload,
            headers={"Prefer": "resolution=merge-duplicates, return=representation"},
            name="Supabase - UPSERT candidates"
        )
        if res_cand and len(res_cand) > 0:
            self.candidate_id = res_cand[0].get("id")
            
        if not self.candidate_id:
            return
            
        # 2. Get Job Posts to retrieve job_post_id (simulate match)
        res_jobs = self.call_supabase("GET", "/rest/v1/job_posts?select=id,title", name="Supabase - GET job_posts")
        if not res_jobs:
            # Create a default job post if none exist
            job_payload = {
                "title": "CSE (Computer Science Engineer)",
                "mode": "AI",
                "status": "ACTIVE"
            }
            res_create = self.call_supabase(
                "POST", 
                "/rest/v1/job_posts", 
                json_data=job_payload,
                headers={"Prefer": "return=representation"},
                name="Supabase - INSERT job_posts seed"
            )
            if res_create and len(res_create) > 0:
                self.job_post_id = res_create[0].get("id")
        else:
            # Match CSE job
            matched = [j for j in res_jobs if "computer" in j.get("title", "").lower() or "cse" in j.get("title", "").lower()]
            if matched:
                self.job_post_id = matched[0].get("id")
            else:
                self.job_post_id = res_jobs[0].get("id")

        # 3. Create Session
        session_payload = {
            "candidate_id": self.candidate_id,
            "status": "CREATED",
            "interview_metadata": {
                "device_info": {"browser": "Locust", "os": "Python"},
                "is_locust": True
            }
        }
        if self.job_post_id:
            session_payload["job_post_id"] = self.job_post_id

        res_sess = self.call_supabase(
            "POST",
            "/rest/v1/interview_sessions",
            json_data=session_payload,
            headers={"Prefer": "return=representation"},
            name="Supabase - INSERT interview_sessions"
        )
        if res_sess and len(res_sess) > 0:
            self.session_id = res_sess[0].get("id")
            
        if not self.session_id:
            return

        # 4. Answer 5 Questions
        for idx, q_data in enumerate(CANDIDATE_FLOW_DATA):
            # Think time simulated by Locust wait_time (between questions)
            
            # Exact production evaluation prompt
            guide_list = q_data.get("evaluationGuide", [])
            if isinstance(guide_list, list):
                guide_str = "\n".join([f"- {g}" for g in guide_list])
            else:
                guide_str = ""
                
            eval_prompt = EVALUATION_PROMPT.format(
                question=q_data["question"],
                ideal_answer=q_data["ideal_answer"],
                type=q_data["type"],
                guideStr=guide_str,
                answer=q_data["answer"],
                scoringGuidelines=SCORING_GUIDELINES
            )
            
            # Evaluate via OpenRouter
            eval_result = self.call_openrouter(eval_prompt, name="OpenRouter - AI Evaluation")
            
            # Save Response
            response_payload = {
                "session_id": self.session_id,
                "question_index": idx,
                "question_text": q_data["question"],
                "candidate_answer": q_data["answer"],
                "ideal_answer": q_data["ideal_answer"],
                "content_score": eval_result.get("contentScore", 7.5),
                "grammar_score": 0,
                "fluency_score": 0,
                "coverage": eval_result.get("conceptCoverage", 8.0),
                "understanding": eval_result.get("conceptUnderstanding", 8.0),
                "reasoning": eval_result.get("reasoning", 7.0),
                "depth": eval_result.get("depth", 7.0),
                "clarity": eval_result.get("clarity", 8.0),
                "structure": eval_result.get("structure", 8.0),
                "confidence": eval_result.get("confidence", 8.0),
                "consistency": eval_result.get("consistency", 8.0),
                "answer_directness_score": eval_result.get("answerDirectnessScore", 9.0),
                "tradeoff_reasoning_score": eval_result.get("tradeoffReasoningScore", 8.0),
                "curiosity": eval_result.get("curiosity", 7.0),
                "self_correction": eval_result.get("selfCorrection", 6.0),
                "learning_potential": eval_result.get("learningPotential", 8.0),
                "technical_errors": eval_result.get("technicalErrors", []),
                "positive_evidence": eval_result.get("positiveEvidence", {}),
                "verdict": "Pass" if eval_result.get("accuracy", 7) >= 6 else "Borderline",
                "feedback": eval_result.get("feedback", "Completed answer."),
                "expected_key_points": q_data["evaluationGuide"],
                "detected_key_points": eval_result.get("matchedKeyPoints", []),
                "missing_key_points": eval_result.get("missingKeyPoints", []),
                "deduction_reason": "Visual check okay"
            }
            
            self.call_supabase(
                "POST", 
                "/rest/v1/session_responses", 
                json_data=response_payload, 
                name="Supabase - INSERT session_responses"
            )
            
            # Keep track of history for contradiction checks
            q_type = q_data.get("type", "")
            is_behavioral = "Behavioral" in str(q_type) if q_type else False
            self.transcripts_history.append({
                "index": idx + 1,
                "question": q_data["question"],
                "answer": q_data["answer"],
                "isBehavioral": is_behavioral
            })
            
            # Simulate a follow-up question (20% probability)
            if random.random() < 0.20:
                followup_prompt = FOLLOWUP_PROMPT.format(
                    difficulty=q_data["difficulty"],
                    question=q_data["question"],
                    answer=q_data["answer"],
                    parent_id=q_data["id"],
                    category=q_data["type"]
                )
                
                # Generate follow-up question
                fu_question = self.call_openrouter(followup_prompt, name="OpenRouter - AI Generate Follow-up")
                
                # Candidate think time for follow-up (10-30 seconds if not FAST_LOAD_MODE)
                if not FAST_LOAD_MODE:
                    time.sleep(random.uniform(10, 30))
                    
                # Evaluate follow-up answer
                fu_eval_prompt = EVALUATION_PROMPT.format(
                    question=fu_question.get("question", "Could you elaborate?"),
                    ideal_answer="Detail explanation matching key concepts.",
                    type="Technical",
                    guideStr="- Elaborate details",
                    answer="Yes, Third normal form eliminates transitive functional dependencies, meaning non-prime attributes must only depend on the superkey.",
                    scoringGuidelines=SCORING_GUIDELINES
                )
                fu_eval_result = self.call_openrouter(fu_eval_prompt, name="OpenRouter - AI Evaluation (Follow-up)")
                
                # Save follow-up response
                fu_response_payload = {
                    "session_id": self.session_id,
                    "question_index": idx + 10,  # distinct index
                    "question_text": fu_question.get("question", "Could you elaborate?"),
                    "candidate_answer": "Yes, Third normal form eliminates transitive functional dependencies...",
                    "ideal_answer": "Detail explanation matching key concepts.",
                    "content_score": fu_eval_result.get("contentScore", 8.0),
                    "grammar_score": 0,
                    "fluency_score": 0,
                    "coverage": fu_eval_result.get("conceptCoverage", 8.0),
                    "understanding": fu_eval_result.get("conceptUnderstanding", 8.0),
                    "reasoning": fu_eval_result.get("reasoning", 8.0),
                    "depth": fu_eval_result.get("depth", 8.0),
                    "clarity": fu_eval_result.get("clarity", 8.0),
                    "structure": fu_eval_result.get("structure", 8.0),
                    "confidence": fu_eval_result.get("confidence", 8.0),
                    "consistency": fu_eval_result.get("consistency", 8.0),
                    "answer_directness_score": fu_eval_result.get("answerDirectnessScore", 9.0),
                    "tradeoff_reasoning_score": fu_eval_result.get("tradeoffReasoningScore", 8.0),
                    "curiosity": fu_eval_result.get("curiosity", 7.0),
                    "self_correction": fu_eval_result.get("selfCorrection", 6.0),
                    "learning_potential": fu_eval_result.get("learningPotential", 8.0),
                    "technical_errors": fu_eval_result.get("technicalErrors", []),
                    "positive_evidence": fu_eval_result.get("positiveEvidence", {}),
                    "verdict": "Pass",
                    "feedback": fu_eval_result.get("feedback", "Excellent clarification."),
                    "expected_key_points": fu_question.get("evaluationGuide", ["Elaborate"]),
                    "detected_key_points": fu_eval_result.get("matchedKeyPoints", []),
                    "missing_key_points": fu_eval_result.get("missingKeyPoints", []),
                    "deduction_reason": "Visual check okay"
                }
                self.call_supabase(
                    "POST", 
                    "/rest/v1/session_responses", 
                    json_data=fu_response_payload, 
                    name="Supabase - INSERT session_responses"
                )

        # 5. Cross-Question Contradictions Check
        tech_transcripts = [t for t in self.transcripts_history if not t["isBehavioral"]]
        transcripts_str = "\n\n".join([f"Answer {t['index']} (to \"{t['question']}\"): \"{t['answer']}\"" for t in tech_transcripts])
        
        contradiction_prompt = CONTRADICTION_PROMPT.format(transcripts=transcripts_str)
        self.call_openrouter(contradiction_prompt, name="OpenRouter - AI Contradiction Check")

        # 6. Save Evaluation Report
        eval_report_payload = {
            "session_id": self.session_id,
            "total_score": 75,
            "technical_score": 80,
            "communication_score": 70,
            "confidence_score": 80,
            "proctoring_score": 100,
            "final_verdict": "Passed with solid engineering fundamentals.",
            "hiring_recommendation": "Hire",
            "strengths": ["Normalization", "TCP handshakes"],
            "failures": [],
            "verdict_justification": "Candidate has strong foundational knowledge of core CS topics.",
            "evaluation_logic": {},
            "risk_score": 0,
            "risk_level": "Low",
            "risk_reason": [],
            "proctoring_summary": {"integrityScore": 100},
            "evaluation_weights_snapshot": {},
            "evaluation_version": "1.0",
            "evaluation_model": "deepseek-chat",
            "evaluated_at": "2026-06-23T14:00:00Z",
            "candidate_outcome": "PENDING"
        }
        self.call_supabase(
            "POST", 
            f"/rest/v1/evaluation_reports?on_conflict=session_id", 
            json_data=eval_report_payload,
            headers={"Prefer": "resolution=merge-duplicates"},
            name="Supabase - UPSERT evaluation_reports"
        )

        # 7. Save Proctoring Report
        proctor_payload = [
            {
                "session_id": self.session_id,
                "event_type": "TAB_SWITCH",
                "severity": "Low",
                "risk_points": 1,
                "message": "Candidate switched tabs once.",
                "occurred_at": "2026-06-23T14:02:00Z"
            }
        ]
        self.call_supabase("POST", "/rest/v1/proctoring_events", json_data=proctor_payload, name="Supabase - INSERT proctoring_events")

        # 8. Complete Session (PATCH status = COMPLETED)
        duration_sec = int(time.time() - self.interview_start_time)
        session_patch = {
            "status": "COMPLETED",
            "completed_at": "2026-06-23T14:10:00Z",
            "duration_seconds": duration_sec
        }
        self.call_supabase(
            "PATCH", 
            f"/rest/v1/interview_sessions?id=eq.{self.session_id}", 
            json_data=session_patch, 
            name="Supabase - PATCH interview_sessions"
        )
        
        # Log duration for local metrics
        completed_interview_durations.append(duration_sec)
        
        # Stop this virtual user's task loop
        raise StopUser()


def write_aborted_metadata(reason):
    filename = f"performance-tests/results/metadata_{TEST_STAGE}.json"
    metadata = {
        "aborted": True,
        "abort_reason": reason,
        "peak_concurrent_ai_requests": peak_ai_requests,
        "total_ai_calls": total_ai_calls,
        "total_ai_402s": global_ai_402s,
        "total_ai_429s": global_ai_429s,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_ai_cost": total_ai_cost,
        "avg_cost_per_completed_interview": 0.0,
        "supabase_failures": supabase_failures,
        "interview_duration_avg_sec": 0.0,
        "interview_duration_p95_sec": 0.0,
        "interview_duration_p99_sec": 0.0,
        "completed_interviews": len(completed_interview_durations),
        "interviews_started": completed_interviews_count
    }
    os.makedirs("performance-tests/results", exist_ok=True)
    with open(filename, "w") as f:
        json.dump(metadata, f, indent=2)
    
    # Also save the detailed AI call log
    log_filename = f"performance-tests/results/ai_call_log_{TEST_STAGE}.json"
    with open(log_filename, "w") as f:
        json.dump(ai_call_log, f, indent=2)
    print(f"Detailed AI call log saved to {log_filename} ({len(ai_call_log)} entries)")


# Health check monitor for Hard Stop conditions
def monitor_hard_stop(environment):
    print("Hard stop monitor active.")
    while environment.runner and not environment.runner.state in ["stopped", "stopping"]:
        gevent.sleep(2)
        
        stats = environment.runner.stats
        total = stats.num_requests
        failures = stats.num_failures
        
        error_rate = failures / total if total > 0 else 0.0
        
        ai_total = global_ai_requests
        ai_429s = global_ai_429s
        ai_402s = global_ai_402s
        ai_429_rate = ai_429s / ai_total if ai_total > 0 else 0.0
        ai_402_rate = ai_402s / ai_total if ai_total > 0 else 0.0
        
        p95_latency_ms = stats.total.get_response_time_percentile(0.95)
        p95_latency_sec = p95_latency_ms / 1000.0 if p95_latency_ms else 0.0
        
        if total > 10:  # Avoid triggering on start-up noise
            reason = None
            if error_rate > 0.20:
                reason = f"Total Error Rate exceeds 20% (current: {error_rate*100:.1f}%)"
            elif ai_402_rate > 0.20:
                reason = f"AI 402 (Payment Required / Free-Tier Exhausted) Rate exceeds 20% (current: {ai_402_rate*100:.1f}%, total 402s: {ai_402s})"
            elif ai_429_rate > 0.30:
                reason = f"AI 429 Rate exceeds 30% (current: {ai_429_rate*100:.1f}%)"
            elif p95_latency_sec > 30.0:
                reason = f"P95 Latency exceeds 30 seconds (current: {p95_latency_sec:.1f}s)"
                
            if reason:
                print(f"\n[HARD STOP TRIGGERED] {reason}. Aborting Locust runner...\n")
                write_aborted_metadata(reason)
                environment.runner.quit()
                break


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    # Spawn stats monitor on master or standalone runner
    if not isinstance(environment.runner, WorkerRunner):
        gevent.spawn(monitor_hard_stop, environment)


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    # Only write results if we didn't write an abort metadata file
    filename = f"performance-tests/results/metadata_{TEST_STAGE}.json"
    if os.path.exists(filename):
        try:
            with open(filename, "r") as f:
                existing = json.load(f)
                if existing.get("aborted"):
                    # Keep aborted metadata file
                    return
        except Exception:
            pass
            
    durations = completed_interview_durations
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    p95_duration = np.percentile(durations, 95) if durations else 0.0
    p99_duration = np.percentile(durations, 99) if durations else 0.0
    
    avg_cost = total_ai_cost / len(durations) if durations else 0.0
    
    metadata = {
        "aborted": False,
        "peak_concurrent_ai_requests": peak_ai_requests,
        "total_ai_calls": total_ai_calls,
        "total_ai_402s": global_ai_402s,
        "total_ai_429s": global_ai_429s,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "total_ai_cost": total_ai_cost,
        "avg_cost_per_completed_interview": avg_cost,
        "supabase_failures": supabase_failures,
        "interview_duration_avg_sec": avg_duration,
        "interview_duration_p95_sec": p95_duration,
        "interview_duration_p99_sec": p99_duration,
        "completed_interviews": len(durations),
        "interviews_started": completed_interviews_count
    }
    
    os.makedirs("performance-tests/results", exist_ok=True)
    with open(filename, "w") as f:
        json.dump(metadata, f, indent=2)
    
    # Also save the detailed AI call log
    log_filename = f"performance-tests/results/ai_call_log_{TEST_STAGE}.json"
    with open(log_filename, "w") as f:
        json.dump(ai_call_log, f, indent=2)
    print(f"Test complete. Metrics saved to {filename}")
    print(f"Detailed AI call log saved to {log_filename} ({len(ai_call_log)} entries)")
