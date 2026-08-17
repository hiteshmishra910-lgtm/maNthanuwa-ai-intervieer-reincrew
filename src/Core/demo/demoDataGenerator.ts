/**
 * Generates 100 demo candidates and their session data programmatically.
 * Keeps Pranita Khobe's 4 hand-crafted entries intact and fills the rest.
 */
import { DemoCandidate, DemoSession } from './demoTypes';

// ─── Name pools ────────────────────────────────────────────────────────────────
const FIRST_NAMES_M = [
  'Aarav','Arjun','Vivaan','Aditya','Vihaan','Reyansh','Krishna','Ishaan',
  'Sai','Arnav','Dhruv','Kabir','Ritvik','Ansh','Shaurya','Advait','Darsh',
  'Pranav','Rudra','Atharv','Laksh','Parth','Yash','Kartik','Rohan','Nikhil',
  'Siddharth','Harsh','Dev','Manav','Kunal','Sahil','Rahul','Vikram','Amit',
  'Rishi','Gautam','Karan','Aman','Akash','Tejas','Varun','Chirag','Sumit',
  'Jayesh','Omkar','Tanmay','Manas','Ishan','Soham',
];
const FIRST_NAMES_F = [
  'Ananya','Priya','Saanvi','Aanya','Aadhya','Isha','Nisha','Pooja','Sneha',
  'Kavya','Diya','Riya','Aisha','Navya','Tanya','Meera','Shreya','Sakshi',
  'Nandini','Simran','Anjali','Divya','Kriti','Sanya','Trisha','Neha','Ruhi',
  'Rashmi','Jiya','Zara','Avni','Pallavi','Madhuri','Swati','Deepika','Sonali',
  'Aditi','Bhavna','Charvi','Gauri','Hema','Ira','Janvi','Lavanya','Mitali',
  'Nikita','Rhea','Suhani','Tanvi','Unnati',
];
const LAST_NAMES = [
  'Sharma','Patel','Verma','Singh','Gupta','Reddy','Joshi','Kumar','Mehta',
  'Nair','Iyer','Rao','Desai','Shah','Malhotra','Chauhan','Chopra','Bhat',
  'Kulkarni','Patil','Mishra','Pandey','Agarwal','Tiwari','Saxena','Kapoor',
  'Sinha','Thakur','Pillai','Menon','Bhatt','Deshpande','Hegde','Kamath',
  'Rajan','Banerjee','Mukherjee','Sen','Dutta','Roy','Ghosh','Das','Bose',
  'Khatri','Arora','Sethi','Gill','Dhawan','Bajaj','Vohra',
];

const ROLES = [
  'Computer Science Engineering (CSE)','Data Science (DS)','Cyber Security (CYBER)',
  'Artificial Intelligence (AI)','Information Technology (IT)',
  'Electronics & Telecommunication (ETC)','Mechanical Engineering (ME)',
  'Electrical Engineering (EE)','Civil Engineering (CE)',
  'Full Stack Developer','Backend Engineer','Frontend Developer',
  'DevOps Engineer','Cloud Architect','ML Engineer','Mobile App Developer',
  'QA Automation Engineer','Systems Architect','Product Engineer','Site Reliability Engineer',
];

const MODES: ('Voice AI' | 'Aptitude' | 'Coding')[] = ['Voice AI', 'Aptitude', 'Coding'];
const OUTCOMES = ['SHORTLIST', 'INTERVIEW_SCHEDULED', 'PENDING', 'REJECT'] as const;

const DRIVES = [
  { id: 'demo-drive-2026-campus', title: 'Engineering Campus Placement 2026' },
  { id: 'demo-drive-lateral', title: 'Senior Systems & AI Engineer Hiring' },
  { id: 'demo-drive-intern', title: 'Summer Internship Programme 2026' },
  { id: 'demo-drive-product', title: 'Product & Platform Engineering Drive' },
];

// ─── Seeded PRNG for deterministic data ────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = seededRandom(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

// ─── Voice AI question templates ───────────────────────────────────────────────
const VOICE_QUESTIONS = [
  { q: 'Explain the SOLID principles and how they improve software design.', d: 'medium' },
  { q: 'How does garbage collection work in JVM-based languages?', d: 'medium' },
  { q: 'Describe the CAP theorem and its implications for distributed systems.', d: 'hard' },
  { q: 'Compare REST and GraphQL. When would you choose one over the other?', d: 'medium' },
  { q: 'What is the difference between optimistic and pessimistic locking?', d: 'hard' },
];

const VOICE_ANSWERS = [
  'The SOLID principles—Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion—guide modular, maintainable OOP design. SRP ensures each class has one reason to change, OCP allows extension without modification via abstractions, LSP guarantees subtypes are substitutable, ISP prevents fat interfaces, and DIP decouples high-level modules from low-level implementations via abstractions.',
  'In JVM languages, the garbage collector automatically reclaims heap memory occupied by unreachable objects. Modern JVMs use generational collection: Young Gen uses copying collection (Eden + Survivor spaces), Old Gen uses mark-sweep-compact or concurrent collectors like G1 or ZGC. G1 divides the heap into regions and prioritizes collecting regions with the most garbage first.',
  'The CAP theorem states a distributed system can guarantee at most two of three properties: Consistency (every read returns the latest write), Availability (every request gets a non-error response), and Partition Tolerance (the system operates despite network partitions). Since partitions are inevitable, real systems choose between CP (e.g., HBase) and AP (e.g., Cassandra) with eventual consistency.',
  'REST uses resource-based URLs with HTTP verbs, is stateless, and benefits from HTTP caching. GraphQL provides a single endpoint with typed queries, enabling clients to request exactly the data they need, reducing over-fetching. REST is better for simple CRUD APIs with caching needs; GraphQL excels in complex UIs needing aggregated data from multiple entities in one request.',
  'Optimistic locking assumes conflicts are rare—it checks a version number at write time and retries on conflict. Pessimistic locking acquires exclusive locks before reading, blocking other transactions. Optimistic is better for high-read, low-contention workloads; pessimistic suits high-contention scenarios where retries would be expensive.',
];

// ─── MCQ question templates ────────────────────────────────────────────────────
const MCQ_QUESTIONS = [
  { q: 'What is the time complexity of binary search on a sorted array of N elements?', opts: ['A. O(N)', 'B. O(log N)', 'C. O(N log N)', 'D. O(1)'], correct: 'B', d: 'easy' },
  { q: 'Which data structure uses LIFO ordering?', opts: ['A. Queue', 'B. Stack', 'C. Heap', 'D. Linked List'], correct: 'B', d: 'easy' },
  { q: 'In SQL, which JOIN returns all rows from both tables including non-matching rows?', opts: ['A. INNER JOIN', 'B. LEFT JOIN', 'C. FULL OUTER JOIN', 'D. CROSS JOIN'], correct: 'C', d: 'medium' },
  { q: 'What is the worst-case time complexity of quicksort?', opts: ['A. O(N)', 'B. O(N log N)', 'C. O(N^2)', 'D. O(log N)'], correct: 'C', d: 'medium' },
  { q: 'Which protocol operates at the transport layer of the OSI model?', opts: ['A. HTTP', 'B. TCP', 'C. IP', 'D. DNS'], correct: 'B', d: 'easy' },
];

// ─── Coding question templates ─────────────────────────────────────────────────
const CODING_QUESTIONS = [
  { q: 'Implement a function to find the longest palindromic substring in a given string.', d: 'hard' },
  { q: 'Write a function to detect a cycle in a linked list using Floyd\'s algorithm.', d: 'medium' },
  { q: 'Implement a LRU cache with O(1) get and put operations.', d: 'hard' },
];

const CODING_ANSWERS = [
  `function longestPalindrome(s: string): string {
  let start = 0, maxLen = 1;
  function expand(l: number, r: number) {
    while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }
    if (r - l - 1 > maxLen) { start = l + 1; maxLen = r - l - 1; }
  }
  for (let i = 0; i < s.length; i++) { expand(i, i); expand(i, i + 1); }
  return s.substring(start, start + maxLen);
}`,
  `function hasCycle(head: ListNode | null): boolean {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}`,
  `class LRUCache {
  private capacity: number;
  private cache = new Map<number, number>();
  constructor(capacity: number) { this.capacity = capacity; }
  get(key: number): number {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  put(key: number, value: number): void {
    this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!);
  }
}`,
];

// ─── Executive summary templates ───────────────────────────────────────────────
const STRENGTHS = [
  'Strong algorithmic problem-solving and data structure fluency',
  'Excellent communication with structured, clear explanations',
  'Deep understanding of system design and scalability patterns',
  'Fast response times with high accuracy across all question types',
  'Demonstrated practical experience with production systems',
  'Strong grasp of distributed systems and consensus protocols',
  'Clean, modular code with proper error handling',
  'Solid understanding of database internals and query optimization',
  'Good understanding of CI/CD pipelines and DevOps practices',
  'Strong mathematical foundations and quantitative reasoning',
];

const IMPROVEMENTS = [
  'Could improve depth on advanced concurrency patterns',
  'Minor gaps in cloud-native architecture knowledge',
  'Should explore more advanced testing strategies (property-based, mutation)',
  'Can strengthen understanding of network security fundamentals',
  'Would benefit from deeper OS internals knowledge',
  'Could improve time management on complex coding problems',
];

// ─── Generator functions ───────────────────────────────────────────────────────
function generateName(index: number): { name: string; gender: 'M' | 'F' } {
  const isFemale = index % 3 === 0;
  const firstName = isFemale ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  const lastName = pick(LAST_NAMES);
  return { name: `${firstName} ${lastName}`, gender: isFemale ? 'F' : 'M' };
}

function generateEmail(name: string, index: number): string {
  const clean = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
  return `${clean}${index}@example.com`;
}

function generateDate(index: number): string {
  const day = 1 + (index % 12);
  const hour = 9 + (index % 9);
  return `2026-08-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:00Z`;
}

function scoreToOutcome(score: number): typeof OUTCOMES[number] {
  if (score >= 85) return 'SHORTLIST';
  if (score >= 70) return 'INTERVIEW_SCHEDULED';
  if (score >= 55) return 'PENDING';
  return 'REJECT';
}

function scoreToRecommendation(score: number): string {
  if (score >= 90) return 'Strong Hire';
  if (score >= 75) return 'Hire';
  if (score >= 60) return 'Consider';
  return 'Needs Improvement';
}

function generateVoiceReport(name: string, role: string, score: number, sessionId: string): any {
  const dimBase = score / 10;
  const dims = {
    technicalAccuracy: Math.min(10, +(dimBase + rand() * 0.8 - 0.4).toFixed(1)),
    conceptUnderstanding: Math.min(10, +(dimBase + rand() * 0.6 - 0.3).toFixed(1)),
    reasoning: Math.min(10, +(dimBase + rand() * 0.7 - 0.35).toFixed(1)),
    problemSolving: Math.min(10, +(dimBase + rand() * 0.8 - 0.4).toFixed(1)),
    communication: Math.min(10, +(dimBase + rand() * 0.5 - 0.25).toFixed(1)),
    fluency: Math.min(10, +(dimBase + rand() * 0.6 - 0.3).toFixed(1)),
  };
  const numQ = randInt(3, 5);
  return {
    sessionId,
    candidateName: name,
    role,
    finalScore: score,
    integrityScore: randInt(90, 100),
    hiringRecommendation: scoreToRecommendation(score),
    executiveSummary: {
      recommendation: scoreToRecommendation(score),
      summary: `${name} demonstrated ${score >= 80 ? 'strong' : score >= 60 ? 'solid' : 'developing'} technical competency in ${role}, scoring ${score}% overall.`,
      keyStrengths: [pick(STRENGTHS), pick(STRENGTHS)],
      areasForImprovement: [pick(IMPROVEMENTS)],
      dimensionBreakdown: dims,
    },
    dimensionScores: { ...dims },
    questionBreakdown: Array.from({ length: numQ }, (_, i) => {
      const tmpl = VOICE_QUESTIONS[i % VOICE_QUESTIONS.length];
      const qScore = +(score / 10 + rand() * 1.5 - 0.75).toFixed(1);
      return {
        questionId: i + 1,
        difficulty: tmpl.d,
        questionText: tmpl.q,
        userAnswer: VOICE_ANSWERS[i % VOICE_ANSWERS.length],
        score: Math.min(10, Math.max(1, qScore)),
        analysis: { understanding: qScore, reasoning: qScore, coverage: qScore, communication: qScore },
        mentionedConcepts: ['Design Patterns', 'Scalability', 'Performance'],
        matchedKeyPoints: ['Core concept coverage', 'Practical application'],
      };
    }),
  };
}

function generateAptitudeReport(name: string, role: string, score: number, sessionId: string): any {
  const dimBase = score / 10;
  const dims = {
    technicalAccuracy: +(dimBase + rand() * 0.5).toFixed(1),
    conceptUnderstanding: +(dimBase + rand() * 0.4).toFixed(1),
    reasoning: +(dimBase + rand() * 0.6).toFixed(1),
    problemSolving: +(dimBase + rand() * 0.5).toFixed(1),
    communication: +(dimBase - 0.5 + rand() * 0.5).toFixed(1),
    fluency: +(dimBase + rand() * 0.3).toFixed(1),
  };
  const numQ = randInt(5, 10);
  return {
    sessionId,
    candidateName: name,
    role,
    finalScore: score,
    integrityScore: 100,
    hiringRecommendation: scoreToRecommendation(score),
    executiveSummary: {
      recommendation: scoreToRecommendation(score),
      summary: `${name} achieved ${score}% on the aptitude assessment for ${role}.`,
      keyStrengths: [pick(STRENGTHS), pick(STRENGTHS)],
      areasForImprovement: [pick(IMPROVEMENTS)],
      dimensionBreakdown: dims,
    },
    dimensionScores: { ...dims },
    questionBreakdown: Array.from({ length: numQ }, (_, i) => {
      const tmpl = MCQ_QUESTIONS[i % MCQ_QUESTIONS.length];
      const isCorrect = rand() < score / 100;
      return {
        questionId: i + 1,
        difficulty: tmpl.d,
        questionText: tmpl.q,
        options: tmpl.opts,
        userAnswer: isCorrect ? tmpl.correct : tmpl.opts[0][0],
        correctAnswer: tmpl.correct,
        score: isCorrect ? 10 : 0,
        explanation: `The correct answer is ${tmpl.correct}.`,
      };
    }),
  };
}

function generateCodingReport(name: string, role: string, score: number, sessionId: string): any {
  const dimBase = score / 10;
  const dims = {
    technicalAccuracy: +(dimBase + rand() * 0.8 - 0.4).toFixed(1),
    conceptUnderstanding: +(dimBase + rand() * 0.6 - 0.3).toFixed(1),
    reasoning: +(dimBase + rand() * 0.7 - 0.35).toFixed(1),
    problemSolving: +(dimBase + rand() * 0.8 - 0.4).toFixed(1),
    communication: +(dimBase + rand() * 0.5 - 0.25).toFixed(1),
    fluency: +(dimBase + rand() * 0.6 - 0.3).toFixed(1),
  };
  const numQ = randInt(1, 3);
  return {
    sessionId,
    candidateName: name,
    role,
    finalScore: score,
    integrityScore: randInt(80, 100),
    hiringRecommendation: scoreToRecommendation(score),
    executiveSummary: {
      recommendation: scoreToRecommendation(score),
      summary: `${name} completed the coding assessment for ${role} with a ${score}% score, passing ${Math.round(score / 10)} out of 10 test cases.`,
      keyStrengths: [pick(STRENGTHS), pick(STRENGTHS)],
      areasForImprovement: [pick(IMPROVEMENTS)],
      dimensionBreakdown: dims,
    },
    dimensionScores: { ...dims },
    questionBreakdown: Array.from({ length: numQ }, (_, i) => {
      const tmpl = CODING_QUESTIONS[i % CODING_QUESTIONS.length];
      const qScore = +(score / 10 + rand() * 1.5 - 0.75).toFixed(1);
      return {
        questionId: i + 1,
        difficulty: tmpl.d,
        questionText: tmpl.q,
        userAnswer: CODING_ANSWERS[i % CODING_ANSWERS.length],
        score: Math.min(10, Math.max(1, qScore)),
        analysis: { understanding: qScore, reasoning: qScore, coverage: qScore, communication: qScore },
        mentionedConcepts: ['Algorithm Design', 'Data Structures', 'Optimization'],
        matchedKeyPoints: ['Correctness', 'Edge case handling'],
      };
    }),
  };
}

// ─── Main generator ────────────────────────────────────────────────────────────
export function generateBulkDemoCandidates(count: number): { candidates: DemoCandidate[]; sessions: Record<string, DemoSession> } {
  const candidates: DemoCandidate[] = [];
  const sessions: Record<string, DemoSession> = {};

  for (let i = 0; i < count; i++) {
    const { name } = generateName(i);
    const email = generateEmail(name, i);
    const role = ROLES[i % ROLES.length];
    const mode = MODES[i % MODES.length];
    const score = randInt(35, 98);
    const integrity = randInt(78, 100);
    const drive = DRIVES[i % DRIVES.length];
    const outcome = scoreToOutcome(score);
    const date = generateDate(i);
    const candId = `demo-cand-gen-${i}`;
    const sessionId = `demo-session-gen-${i}`;

    candidates.push({
      id: candId,
      name,
      email,
      role,
      mode,
      score,
      outcome,
      integrityScore: integrity,
      sessionStatus: 'COMPLETED',
      date,
      driveId: drive.id,
      driveTitle: drive.title,
      isDemo: true,
    });

    let report: any;
    if (mode === 'Voice AI') {
      report = generateVoiceReport(name, role, score, sessionId);
    } else if (mode === 'Aptitude') {
      report = generateAptitudeReport(name, role, score, sessionId);
    } else {
      report = generateCodingReport(name, role, score, sessionId);
    }

    const proctoringViolations = integrity < 90 ? [
      {
        id: `viol-gen-${i}`,
        type: 'TAB_SWITCH',
        severity: integrity < 85 ? 'MEDIUM' : 'LOW',
        message: `Candidate switched tabs for ${(rand() * 8 + 2).toFixed(1)} seconds.`,
        occurredAt: date,
      },
    ] : [];

    sessions[sessionId] = {
      id: sessionId,
      candidate_id: candId,
      candidate_name: name,
      candidate_email: email,
      drive_title: drive.title,
      drive_id: drive.id,
      overall_score: score,
      session_status: 'COMPLETED',
      candidate_outcome: outcome,
      date,
      isDemo: true,
      evaluation_logic: report,
      proctoringReport: integrity < 95 ? {
        sessionId,
        candidateName: name,
        overallRiskScore: 100 - integrity,
        integrityScore: integrity,
        violations: proctoringViolations,
        faceStatus: 'VERIFIED',
        cameraActive: true,
        audioAlerts: 0,
      } as any : undefined,
      all_questions_and_answers: report.questionBreakdown,
      all_proctoring_events: proctoringViolations,
    };
  }

  return { candidates, sessions };
}
