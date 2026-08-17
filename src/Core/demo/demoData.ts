import { DemoCandidate, DemoSession, DemoDrive } from './demoTypes';
import { generateBulkDemoCandidates } from './demoDataGenerator';

export const DEMO_DRIVES: DemoDrive[] = [
  {
    id: 'demo-drive-2026-campus',
    title: 'Engineering Campus Placement 2026',
    description: 'Comprehensive campus drive covering CSE, DS, Cyber Security, and IT candidates.',
    status: 'ACTIVE',
    total_candidates: 11,
    completed_candidates: 11,
    created_at: '2026-08-01T09:00:00Z',
    isDemo: true,
  },
  {
    id: 'demo-drive-lateral',
    title: 'Senior Systems & AI Engineer Hiring',
    description: 'Specialized evaluation drive for mid-to-senior technical roles.',
    status: 'ACTIVE',
    total_candidates: 6,
    completed_candidates: 6,
    created_at: '2026-08-05T10:00:00Z',
    isDemo: true,
  },
  {
    id: 'demo-drive-intern',
    title: 'Summer Internship Programme 2026',
    description: 'Internship screening for pre-final and final year engineering students.',
    status: 'ACTIVE',
    total_candidates: 0,
    completed_candidates: 0,
    created_at: '2026-07-15T09:00:00Z',
    isDemo: true,
  },
  {
    id: 'demo-drive-product',
    title: 'Product & Platform Engineering Drive',
    description: 'Hiring drive for product engineers across frontend, backend, and platform teams.',
    status: 'ACTIVE',
    total_candidates: 0,
    completed_candidates: 0,
    created_at: '2026-08-08T09:00:00Z',
    isDemo: true,
  },
];

export const DEMO_CANDIDATES: DemoCandidate[] = [
  // --- PRANITA KHOBE (USER DEMO PROFILES - HIGH, MEDIUM, LOW REPORTS) ---
  {
    id: 'demo-cand-pranita-1',
    name: 'Pranita Khobe',
    email: 'pranitakhobe22@gmail.com',
    role: 'Lead AI & Deep Learning Architect',
    mode: 'Voice AI',
    score: 94,
    outcome: 'SHORTLIST',
    integrityScore: 99,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T14:00:00Z',
    driveId: 'demo-drive-lateral',
    driveTitle: 'Senior Systems & AI Engineer Hiring',
    isDemo: true,
  },
  {
    id: 'demo-cand-pranita-2',
    name: 'Pranita Khobe',
    email: 'pranitakhobe22@gmail.com',
    role: 'Senior Full Stack Systems Engineer',
    mode: 'Aptitude',
    score: 74,
    outcome: 'INTERVIEW_SCHEDULED',
    integrityScore: 100,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T11:30:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-pranita-3',
    name: 'Pranita Khobe',
    email: 'pranitakhobe22@gmail.com',
    role: 'Backend Microservices Specialist',
    mode: 'Coding',
    score: 52,
    outcome: 'REJECT',
    integrityScore: 78,
    sessionStatus: 'COMPLETED',
    date: '2026-08-11T15:20:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-pranita-4',
    name: 'Pranita Khobe',
    email: 'pranitakhobe22@gmail.com',
    role: 'Cyber Security & Cloud Lead',
    mode: 'Voice AI',
    score: 88,
    outcome: 'SHORTLIST',
    integrityScore: 97,
    sessionStatus: 'COMPLETED',
    date: '2026-08-10T16:00:00Z',
    driveId: 'demo-drive-lateral',
    driveTitle: 'Senior Systems & AI Engineer Hiring',
    isDemo: true,
  },

  // --- ADDITIONAL DEMO CANDIDATES ---
  {
    id: 'demo-cand-aarav',
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    role: 'Computer Science Engineering (CSE)',
    mode: 'Voice AI',
    score: 86,
    outcome: 'SHORTLIST',
    integrityScore: 98,
    sessionStatus: 'COMPLETED',
    date: '2026-08-10T14:30:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-priya',
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    role: 'Data Science (DS)',
    mode: 'Aptitude',
    score: 78,
    outcome: 'INTERVIEW_SCHEDULED',
    integrityScore: 100,
    sessionStatus: 'COMPLETED',
    date: '2026-08-11T10:15:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-rohan',
    name: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    role: 'Cyber Security (CYBER)',
    mode: 'Coding',
    score: 91,
    outcome: 'SHORTLIST',
    integrityScore: 95,
    sessionStatus: 'COMPLETED',
    date: '2026-08-11T16:45:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-vikram',
    name: 'Vikram Singh',
    email: 'vikram.singh@example.com',
    role: 'Electronics & Telecommunication (ETC)',
    mode: 'Voice AI',
    score: 67,
    outcome: 'PENDING',
    integrityScore: 97,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T09:20:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-sneha',
    name: 'Sneha Reddy',
    email: 'sneha.reddy@example.com',
    role: 'Information Technology (IT)',
    mode: 'Aptitude',
    score: 58,
    outcome: 'REJECT',
    integrityScore: 100,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T11:00:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-ananya',
    name: 'Ananya Gupta',
    email: 'ananya.gupta@example.com',
    role: 'Computer Science Engineering (CSE)',
    mode: 'Coding',
    score: 83,
    outcome: 'INTERVIEW_SCHEDULED',
    integrityScore: 92,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T12:15:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
  {
    id: 'demo-cand-karan',
    name: 'Karan Joshi',
    email: 'karan.joshi@example.com',
    role: 'Mechanical Engineering (ME)',
    mode: 'Voice AI',
    score: 72,
    outcome: 'PENDING',
    integrityScore: 96,
    sessionStatus: 'COMPLETED',
    date: '2026-08-12T13:00:00Z',
    driveId: 'demo-drive-2026-campus',
    driveTitle: 'Engineering Campus Placement 2026',
    isDemo: true,
  },
];

// --- REPORT 1: PRANITA KHOBE - Lead AI Architect (HIGH SCORE 94%) ---
const PRANITA_HIGH_VOICE_REPORT: any = {
  sessionId: 'demo-session-pranita-1',
  candidateName: 'Pranita Khobe',
  role: 'Lead AI & Deep Learning Architect',
  finalScore: 94,
  integrityScore: 99,
  hiringRecommendation: 'Strong Hire',
  executiveSummary: {
    recommendation: 'Strong Hire',
    summary: 'Pranita demonstrated top-tier engineering leadership in deep learning model parallelism, transformer optimization, and large-scale AI system design. Exhibited exceptional mathematical precision and hardware-aware optimization instincts.',
    keyStrengths: [
      'Mastery of FlashAttention-2 SRAM tiling algorithms and GPU HBM bandwidth fusion',
      'Flawless analytical formulation of Direct Preference Optimization (DPO) vs PPO advantages',
      'Expert understanding of DeepSpeed ZeRO-3 parameter sharding and all-gather communication primitives',
      'Deep insight into HNSW vector graph traversal trade-offs for ultra-low latency RAG pipelines',
    ],
    areasForImprovement: [
      'Can explore emerging quantized KV-cache compression techniques (e.g. KIVI / FlexGen) for ultra-long context windows (>128k tokens)',
    ],
    dimensionBreakdown: {
      technicalAccuracy: 9.6,
      conceptUnderstanding: 9.5,
      reasoning: 9.4,
      problemSolving: 9.5,
      communication: 9.2,
      fluency: 9.3,
    },
  },
  dimensionScores: {
    technicalAccuracy: 9.6,
    conceptUnderstanding: 9.5,
    reasoning: 9.4,
    problemSolving: 9.5,
    communication: 9.2,
  },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'hard',
      questionText: 'Explain how Multi-Head Self-Attention scales computational complexity with sequence length N and hidden dimension d, and how FlashAttention-2 optimizes memory bandwidth IO.',
      userAnswer: 'Multi-Head Self-Attention computes Q, K, V projections resulting in O(N^2 * d) time and memory complexity due to materializing the N x N attention matrix. FlashAttention-2 avoids materializing intermediate attention matrices in HBM by tiling Q, K, V blocks into GPU SRAM, fusing softmax scaling, and computing online softmax via re-scaling. This reduces memory read/write traffic from O(N^2) HBM IO down to O(N) SRAM IO, yielding up to 3x speedup on A100/H100 GPUs.',
      score: 9.6,
      analysis: { understanding: 9.8, reasoning: 9.5, coverage: 9.6, communication: 9.4 },
      mentionedConcepts: ['FlashAttention-2', 'SRAM Tiling', 'Online Softmax Re-scaling', 'HBM IO Bandwidth', 'O(N^2) Attention Matrix'],
      matchedKeyPoints: ['Attention matrix memory bottleneck', 'SRAM tiling fused kernel', 'HBM read/write reduction'],
    },
    {
      questionId: 2,
      difficulty: 'hard',
      questionText: 'Compare Direct Preference Optimization (DPO) with Proximal Policy Optimization (PPO) in aligning foundation model responses.',
      userAnswer: 'PPO uses an actor-critic RL architecture requiring 4 concurrent models in memory (actor, critic, reference, reward model), requiring complex generalized advantage estimation and PPO clipping. DPO reparameterizes the reward function analytically via the implicit reward formulation r(x,y) = beta * log(pi_theta(y|x) / pi_ref(y|x)), converting the RL objective into a simple binary cross-entropy loss over preference pairs. This eliminates the critic network, stabilizes training, and reduces VRAM footprint by 3x.',
      score: 9.5,
      analysis: { understanding: 9.6, reasoning: 9.5, coverage: 9.5, communication: 9.4 },
      mentionedConcepts: ['Implicit Reward Formulation', 'Direct Preference Optimization', 'PPO Actor-Critic', 'Cross-Entropy Loss'],
      matchedKeyPoints: ['Elimination of reward/critic model', 'Closed-form loss reparameterization', 'VRAM and stability gains'],
    },
    {
      questionId: 3,
      difficulty: 'hard',
      questionText: 'How does DeepSpeed ZeRO-3 partition model states across GPU clusters during training and forward/backward passes?',
      userAnswer: 'ZeRO-1 partitions optimizer states (4x memory savings), ZeRO-2 partitions gradients (8x savings), and ZeRO-3 partitions layer parameter weights (N-fold savings). During forward pass, ZeRO-3 broadcasts layer weights via all-gather right before computation and immediately discards them after the layer finishes. During backward pass, parameters are gathered again to compute gradients, and gradients are reduced-scattered across nodes.',
      score: 9.4,
      analysis: { understanding: 9.5, reasoning: 9.4, coverage: 9.4, communication: 9.2 },
      mentionedConcepts: ['ZeRO-3 Parameter Partitioning', 'All-Gather Communication', 'Reduce-Scatter Primitives', 'Memory Footprint Reduction'],
      matchedKeyPoints: ['Optimizer/Gradient/Weight sharding', 'Just-in-time weight gathering', 'Reduce-scatter gradient communication'],
    },
    {
      questionId: 4,
      difficulty: 'hard',
      questionText: 'What trade-offs occur when applying post-training quantization (PTQ AWQ/GPTQ) vs Quantization-Aware Training (QAT)?',
      userAnswer: 'AWQ protects activation-salient weight channels by inspecting activation magnitude distribution rather than weight norm, preserving accuracy at INT4 with minimal perplexity degradation. GPTQ applies second-order Taylor expansion to update unquantized weights iteratively. PTQ is zero-retraining cost, whereas QAT models quantization error directly during fine-tuning via straight-through estimators for maximal accuracy.',
      score: 9.3,
      analysis: { understanding: 9.4, reasoning: 9.3, coverage: 9.3, communication: 9.2 },
      mentionedConcepts: ['Activation Salience', 'AWQ vs GPTQ', 'Post-Training Quantization', 'Straight-Through Estimator'],
      matchedKeyPoints: ['Activation salience preservation', 'Hessian matrix weight updates', 'Zero-retraining speed vs QAT accuracy'],
    },
    {
      questionId: 5,
      difficulty: 'medium',
      questionText: 'How does Hierarchical Navigable Small World (HNSW) graph indexing optimize vector similarity search in RAG pipelines?',
      userAnswer: 'HNSW creates a multi-layer skip-list graph hierarchy. Top layers contain sparse long-distance links for fast global routing, while lower layers contain dense local nearest neighbors. Search starts at top layer via greedy routing, descending layers until reaching layer 0 for fine-grained k-NN search. It achieves logarithmic O(log N) search complexity with high recall precision.',
      score: 9.2,
      analysis: { understanding: 9.3, reasoning: 9.2, coverage: 9.2, communication: 9.1 },
      mentionedConcepts: ['HNSW Graph', 'Skip-List Hierarchy', 'Greedy Routing', 'Logarithmic Complexity O(log N)'],
      matchedKeyPoints: ['Multi-layer graph skip-list', 'Greedy vector routing', 'Recall vs latency tuning'],
    },
  ],
};

// --- REPORT 2: PRANITA KHOBE - Senior Full Stack Engineer (MEDIUM SCORE 74%) ---
const PRANITA_MEDIUM_APTITUDE_REPORT: any = {
  sessionId: 'demo-session-pranita-2',
  candidateName: 'Pranita Khobe',
  role: 'Senior Full Stack Systems Engineer',
  finalScore: 74,
  integrityScore: 100,
  hiringRecommendation: 'Hire',
  executiveSummary: {
    recommendation: 'Hire',
    summary: 'Pranita achieved a solid 74% score on advanced quantitative logic, algorithmic reasoning, and mathematical aptitude, exhibiting high speed and steady accuracy.',
    keyStrengths: [
      'Top score in logical pattern deduction and probability calculations',
      'Fast average response time per question (38 seconds)',
      '100% proctoring integrity with zero distraction flags',
    ],
    areasForImprovement: [
      'Slight speed tradeoff on complex permutation & combination counting problems',
    ],
    dimensionBreakdown: {
      technicalAccuracy: 7.8,
      conceptUnderstanding: 7.5,
      reasoning: 7.8,
      problemSolving: 7.5,
      communication: 7.0,
      fluency: 7.5,
    },
  },
  dimensionScores: {
    technicalAccuracy: 7.8,
    conceptUnderstanding: 7.5,
    reasoning: 7.8,
    problemSolving: 7.5,
    communication: 7.0,
  },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'easy',
      questionText: 'If a microservice handles 1200 requests/min and takes 50ms per request, what is the minimum concurrent worker threads required without queue buildup?',
      options: ['A. 1 thread', 'B. 2 threads', 'C. 5 threads', 'D. 10 threads'],
      userAnswer: 'A',
      correctAnswer: 'A',
      score: 10,
      explanation: '1200 req/min = 20 req/sec. Each request takes 0.05s. Total capacity required = 20 * 0.05 = 1 concurrent thread.',
    },
    {
      questionId: 2,
      difficulty: 'medium',
      questionText: 'Find the next term in the logical sequence: 2, 6, 12, 20, 30, 42, ?',
      options: ['A. 52', 'B. 56', 'C. 60', 'D. 64'],
      userAnswer: 'B',
      correctAnswer: 'B',
      score: 10,
      explanation: 'Differences between terms are 4, 6, 8, 10, 12. Next difference is 14 -> 42 + 14 = 56.',
    },
    {
      questionId: 3,
      difficulty: 'medium',
      questionText: 'What is the probability of selecting a red ball from a bag containing 5 red, 3 blue, and 2 green balls?',
      options: ['A. 1/2', 'B. 3/10', 'C. 1/5', 'D. 2/5'],
      userAnswer: 'A',
      correctAnswer: 'A',
      score: 10,
      explanation: 'Total balls = 5 + 3 + 2 = 10. Red balls = 5. Probability = 5/10 = 1/2.',
    },
    {
      questionId: 4,
      difficulty: 'medium',
      questionText: 'An algorithm has O(N log N) time complexity. If N=1000 takes 10ms, approximately how long will N=10,000 take?',
      options: ['A. 100ms', 'B. 133ms', 'C. 200ms', 'D. 400ms'],
      userAnswer: 'B',
      correctAnswer: 'B',
      score: 10,
      explanation: '(10,000 * log2(10000)) / (1000 * log2(1000)) = (10000 * 13.3) / (1000 * 10) = 133ms.',
    },
    {
      questionId: 5,
      difficulty: 'easy',
      questionText: 'If 3 developers build 3 features in 3 days, how many days will 6 developers take to build 6 features at the same rate?',
      options: ['A. 3 days', 'B. 6 days', 'C. 9 days', 'D. 12 days'],
      userAnswer: 'A',
      correctAnswer: 'A',
      score: 10,
      explanation: 'Rate = (3 features) / (3 dev * 3 days) = 1/3 feature per dev-day. 6 dev * 3 days * (1/3) = 6 features.',
    },
  ],
};

// --- REPORT 3: PRANITA KHOBE - Backend Microservices Specialist (LOW SCORE 52%) ---
const PRANITA_LOW_CODING_REPORT: any = {
  sessionId: 'demo-session-pranita-3',
  candidateName: 'Pranita Khobe',
  role: 'Backend Microservices Specialist',
  finalScore: 52,
  integrityScore: 78,
  hiringRecommendation: 'Consider',
  executiveSummary: {
    recommendation: 'Consider',
    summary: 'Pranita implemented a working basic token bucket rate limiter but encountered race condition edge-cases during multi-threaded stress tests, passing 5 out of 10 test cases.',
    keyStrengths: [
      'Clean code structure and readable class interfaces',
      'Good initial understanding of token replenishment rate calculations',
    ],
    areasForImprovement: [
      'Race conditions under concurrent thread access (missing atomic mutex acquisition)',
      'Uncaught memory leak when stale IP keys accumulate in cache without eviction worker',
      'Proctoring warning: 1 tab switch event detected during coding phase',
    ],
    dimensionBreakdown: {
      technicalAccuracy: 5.5,
      conceptUnderstanding: 5.8,
      reasoning: 5.0,
      problemSolving: 5.2,
      communication: 5.5,
      fluency: 5.2,
    },
  },
  dimensionScores: {
    technicalAccuracy: 5.5,
    conceptUnderstanding: 5.8,
    reasoning: 5.0,
    problemSolving: 5.2,
    communication: 5.5,
  },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'hard',
      questionText: 'Implement a high-throughput thread-safe Rate Limiter class supporting Token Bucket eviction for distributed microservices.',
      userAnswer: `export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRate: number;
  private tokens: Map<string, { count: number; lastRefill: number }> = new Map();

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
  }

  public allowRequest(ip: string): boolean {
    const now = Date.now();
    let bucket = this.tokens.get(ip);
    if (!bucket) {
      bucket = { count: this.capacity, lastRefill: now };
      this.tokens.set(ip, bucket);
    }
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    bucket.count = Math.min(this.capacity, bucket.count + elapsedSec * this.refillRate);
    bucket.lastRefill = now;

    if (bucket.count >= 1) {
      bucket.count -= 1;
      return true;
    }
    return false;
  }
}`,
      score: 5.2,
      analysis: { understanding: 5.5, reasoning: 5.0, coverage: 5.2, communication: 5.5 },
      mentionedConcepts: ['Token Bucket', 'Timestamp Refill', 'Map Lookup'],
      matchedKeyPoints: ['Basic token calculation', 'Missing atomic lock mutex', 'Unbounded Map memory growth'],
    },
  ],
};

const PRANITA_LOW_PROCTORING_REPORT = {
  sessionId: 'demo-session-pranita-3',
  candidateName: 'Pranita Khobe',
  overallRiskScore: 22,
  integrityScore: 78,
  violations: [
    {
      id: 'viol-pranita-1',
      type: 'TAB_SWITCH',
      severity: 'MEDIUM',
      message: 'Candidate switched tabs for 6.2 seconds before returning to IDE.',
      occurredAt: '2026-08-11T15:35:10Z',
    },
  ],
  faceStatus: 'VERIFIED',
  cameraActive: true,
  audioAlerts: 0,
};

// --- REPORT 4: PRANITA KHOBE - Cyber Security Lead (HIGH SCORE 88%) ---
const PRANITA_HIGH_SECURITY_REPORT: any = {
  sessionId: 'demo-session-pranita-4',
  candidateName: 'Pranita Khobe',
  role: 'Cyber Security & Cloud Lead',
  finalScore: 88,
  integrityScore: 97,
  hiringRecommendation: 'Strong Hire',
  executiveSummary: {
    recommendation: 'Strong Hire',
    summary: 'Pranita demonstrated robust mastery of cloud security postures, mTLS Zero-Trust architectures, and eBPF kernel threat monitoring.',
    keyStrengths: [
      'Deep architectural knowledge of mTLS SPIFFE/SPIRE workload identity',
      'Articulate threat model explanations for Layer 7 DDoS mitigation',
      'Solid incident response protocol and CloudTrail log forensics',
    ],
    areasForImprovement: [
      'Can explore deeper memory safety guarantees in eBPF ring buffer allocations',
    ],
    dimensionBreakdown: {
      technicalAccuracy: 9.0,
      conceptUnderstanding: 8.8,
      reasoning: 8.7,
      problemSolving: 8.8,
      communication: 8.6,
      fluency: 8.8,
    },
  },
  dimensionScores: {
    technicalAccuracy: 9.0,
    conceptUnderstanding: 8.8,
    reasoning: 8.7,
    problemSolving: 8.8,
    communication: 8.6,
  },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'hard',
      questionText: 'Explain how Zero Trust Architecture enforces Mutual TLS (mTLS) and SPIFFE/SPIRE workload identity in a Kubernetes service mesh.',
      userAnswer: 'Zero Trust eliminates perimeter trust by verifying every inter-service call. SPIRE acts as an identity provider that attests workload pods based on cgroups, namespace, and service account tokens, issuing short-lived X.509 SVID certificates. Envoy sidecars handle mTLS handshakes, validating client and server certificates on every TCP connection.',
      score: 9.0,
      analysis: { understanding: 9.2, reasoning: 9.0, coverage: 9.0, communication: 8.8 },
      mentionedConcepts: ['mTLS', 'SPIFFE/SPIRE', 'Envoy Sidecar', 'X.509 SVID', 'Workload Attestation'],
      matchedKeyPoints: ['Pod attestation mechanics', 'Short-lived X.509 certificates', 'Envoy sidecar mTLS termination'],
    },
    {
      questionId: 2,
      difficulty: 'hard',
      questionText: 'How does eBPF enhance container runtime security and real-time threat detection over traditional ptrace or auditd?',
      userAnswer: 'eBPF programs run directly inside the Linux kernel bytecode engine with JIT compilation, hooking into kprobes and tracepoints without user-space context-switching overhead. Unlike ptrace, which blocks syscall execution and incurs high latency, eBPF captures kernel events (sys_execve, socket connections) asynchronously at native kernel speed via ring buffers.',
      score: 8.8,
      analysis: { understanding: 8.9, reasoning: 8.8, coverage: 8.8, communication: 8.7 },
      mentionedConcepts: ['eBPF Bytecode', 'Kernel Hooks (kprobes)', 'Ring Buffer', 'Zero-overhead Security'],
      matchedKeyPoints: ['In-kernel bytecode execution', 'Zero context-switch overhead', 'Asynchronous event ring buffers'],
    },
  ],
};

// --- MODE 1: Spoken Voice AI Technical Interview Report (Aarav Sharma) ---
const AARAV_VOICE_REPORT: any = {
  sessionId: 'demo-session-aarav',
  candidateName: 'Aarav Sharma',
  role: 'Computer Science Engineering (CSE)',
  finalScore: 86,
  integrityScore: 98,
  hiringRecommendation: 'Strong Hire',
  executiveSummary: {
    recommendation: 'Strong Hire',
    summary: 'Aarav demonstrated exceptional command of full-stack engineering, async concurrency patterns, and microservices architecture.',
    keyStrengths: [
      'Deep mastery of asynchronous event-driven design and React lifecycle mechanics',
      'Robust understanding of SQL transaction isolation levels & indexing',
    ],
    areasForImprovement: [
      'Can dive deeper into memory footprint bounds when scaling Redis caches',
    ],
    dimensionBreakdown: {
      technicalAccuracy: 9.0,
      conceptUnderstanding: 8.8,
      reasoning: 8.5,
      problemSolving: 9.0,
      communication: 8.5,
      fluency: 8.5,
    },
  },
  dimensionScores: {
    technicalAccuracy: 9.0,
    conceptUnderstanding: 8.8,
    reasoning: 8.5,
    problemSolving: 9.0,
    communication: 8.5,
  },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'medium',
      questionText: 'Explain the difference between a process and a thread in modern OS kernel scheduling.',
      userAnswer: 'A process is an executing instance of a program with its own isolated virtual memory space. A thread is an execution unit within a process that shares memory space.',
      score: 9.0,
      analysis: { understanding: 9.2, reasoning: 9.0, coverage: 9.0, communication: 8.8 },
      mentionedConcepts: ['Virtual Memory', 'Context Switching', 'Thread Pool'],
      matchedKeyPoints: ['Memory space isolation', 'Shared heap vs stack'],
    },
  ],
};

// --- MODE 2: Aptitude MCQ Assessment Report (Priya Patel) ---
const PRIYA_APTITUDE_REPORT: any = {
  sessionId: 'demo-session-priya',
  candidateName: 'Priya Patel',
  role: 'Data Science (DS)',
  finalScore: 78,
  integrityScore: 100,
  hiringRecommendation: 'Hire',
  executiveSummary: {
    recommendation: 'Hire',
    summary: 'Priya achieved strong quantitative and logical problem-solving scores (78%).',
    keyStrengths: ['Top 5% score in quantitative logic', 'Fast average response time'],
    areasForImprovement: ['Reading comprehension speed'],
    dimensionBreakdown: { technicalAccuracy: 8.2, conceptUnderstanding: 8.0, reasoning: 8.5, problemSolving: 8.0, communication: 7.5, fluency: 8.0 },
  },
  dimensionScores: { technicalAccuracy: 8.2, conceptUnderstanding: 8.0, reasoning: 8.5, problemSolving: 8.0, communication: 7.5 },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'easy',
      questionText: 'If a train traveling at 72 km/h crosses a 200m long platform in 25 seconds, what is the length of the train?',
      options: ['A. 250m', 'B. 300m', 'C. 350m', 'D. 400m'],
      userAnswer: 'B',
      correctAnswer: 'B',
      score: 10,
      explanation: '72 km/h = 20 m/s. Distance = 20 * 25 = 500m. Train length = 500 - 200 = 300m.',
    },
  ],
};

// --- MODE 3: Coding Assessment Report (Rohan Verma) ---
const ROHAN_CODING_REPORT: any = {
  sessionId: 'demo-session-rohan',
  candidateName: 'Rohan Verma',
  role: 'Cyber Security (CYBER)',
  finalScore: 91,
  integrityScore: 95,
  hiringRecommendation: 'Strong Hire',
  executiveSummary: {
    recommendation: 'Strong Hire',
    summary: 'Rohan submitted an optimal algorithmic solution with 100% test case coverage.',
    keyStrengths: ['100% test case pass rate', 'O(N log N) time complexity'],
    areasForImprovement: ['Explicit inline safety guards'],
    dimensionBreakdown: { technicalAccuracy: 9.5, conceptUnderstanding: 9.0, reasoning: 9.2, problemSolving: 9.2, communication: 8.5, fluency: 9.0 },
  },
  dimensionScores: { technicalAccuracy: 9.5, conceptUnderstanding: 9.0, reasoning: 9.2, problemSolving: 9.2, communication: 8.5 },
  questionBreakdown: [
    {
      questionId: 1,
      difficulty: 'hard',
      questionText: 'Implement CIDR subnet overlap detection algorithm.',
      userAnswer: `export function detectCIDROverlaps(cidrs: string[]) { return []; }`,
      score: 9.5,
      analysis: { understanding: 9.5, reasoning: 9.2, coverage: 9.5, communication: 8.8 },
      mentionedConcepts: ['CIDR Parsing', 'O(N log N) Sort'],
      matchedKeyPoints: ['Numeric IP conversion', 'Prefix length sorting'],
    },
  ],
};

const ROHAN_PROCTORING_REPORT = {
  sessionId: 'demo-session-rohan',
  candidateName: 'Rohan Verma',
  overallRiskScore: 5,
  integrityScore: 95,
  violations: [
    {
      id: 'viol-1',
      type: 'TAB_SWITCH',
      severity: 'LOW',
      message: 'Candidate switched tabs for 4.8 seconds before returning.',
      occurredAt: '2026-08-11T17:00:22Z',
    },
  ],
  faceStatus: 'VERIFIED',
  cameraActive: true,
  audioAlerts: 0,
};

export const DEMO_SESSIONS: Record<string, DemoSession> = {
  // PRANITA KHOBE SESSIONS
  'demo-session-pranita-1': {
    id: 'demo-session-pranita-1',
    candidate_id: 'demo-cand-pranita-1',
    candidate_name: 'Pranita Khobe',
    candidate_email: 'pranitakhobe22@gmail.com',
    drive_title: 'Senior Systems & AI Engineer Hiring',
    drive_id: 'demo-drive-lateral',
    overall_score: 94,
    session_status: 'COMPLETED',
    candidate_outcome: 'SHORTLIST',
    date: '2026-08-12T14:00:00Z',
    isDemo: true,
    evaluation_logic: PRANITA_HIGH_VOICE_REPORT,
    all_questions_and_answers: PRANITA_HIGH_VOICE_REPORT.questionBreakdown,
    all_proctoring_events: [],
  },
  'demo-session-pranita-2': {
    id: 'demo-session-pranita-2',
    candidate_id: 'demo-cand-pranita-2',
    candidate_name: 'Pranita Khobe',
    candidate_email: 'pranitakhobe22@gmail.com',
    drive_title: 'Engineering Campus Placement 2026',
    drive_id: 'demo-drive-2026-campus',
    overall_score: 74,
    session_status: 'COMPLETED',
    candidate_outcome: 'INTERVIEW_SCHEDULED',
    date: '2026-08-12T11:30:00Z',
    isDemo: true,
    evaluation_logic: PRANITA_MEDIUM_APTITUDE_REPORT,
    all_questions_and_answers: PRANITA_MEDIUM_APTITUDE_REPORT.questionBreakdown,
    all_proctoring_events: [],
  },
  'demo-session-pranita-3': {
    id: 'demo-session-pranita-3',
    candidate_id: 'demo-cand-pranita-3',
    candidate_name: 'Pranita Khobe',
    candidate_email: 'pranitakhobe22@gmail.com',
    drive_title: 'Engineering Campus Placement 2026',
    drive_id: 'demo-drive-2026-campus',
    overall_score: 52,
    session_status: 'COMPLETED',
    candidate_outcome: 'REJECT',
    date: '2026-08-11T15:20:00Z',
    isDemo: true,
    evaluation_logic: PRANITA_LOW_CODING_REPORT,
    proctoringReport: PRANITA_LOW_PROCTORING_REPORT as any,
    all_questions_and_answers: PRANITA_LOW_CODING_REPORT.questionBreakdown,
    all_proctoring_events: PRANITA_LOW_PROCTORING_REPORT.violations,
  },
  'demo-session-pranita-4': {
    id: 'demo-session-pranita-4',
    candidate_id: 'demo-cand-pranita-4',
    candidate_name: 'Pranita Khobe',
    candidate_email: 'pranitakhobe22@gmail.com',
    drive_title: 'Senior Systems & AI Engineer Hiring',
    drive_id: 'demo-drive-lateral',
    overall_score: 88,
    session_status: 'COMPLETED',
    candidate_outcome: 'SHORTLIST',
    date: '2026-08-10T16:00:00Z',
    isDemo: true,
    evaluation_logic: PRANITA_HIGH_SECURITY_REPORT,
    all_questions_and_answers: PRANITA_HIGH_SECURITY_REPORT.questionBreakdown,
    all_proctoring_events: [],
  },

  // OTHER CANDIDATE SESSIONS
  'demo-session-aarav': {
    id: 'demo-session-aarav',
    candidate_id: 'demo-cand-aarav',
    candidate_name: 'Aarav Sharma',
    candidate_email: 'aarav.sharma@example.com',
    drive_title: 'Engineering Campus Placement 2026',
    drive_id: 'demo-drive-2026-campus',
    overall_score: 86,
    session_status: 'COMPLETED',
    candidate_outcome: 'SHORTLIST',
    isDemo: true,
    evaluation_logic: AARAV_VOICE_REPORT,
    all_questions_and_answers: AARAV_VOICE_REPORT.questionBreakdown,
    all_proctoring_events: [],
  },
  'demo-session-priya': {
    id: 'demo-session-priya',
    candidate_id: 'demo-cand-priya',
    candidate_name: 'Priya Patel',
    candidate_email: 'priya.patel@example.com',
    drive_title: 'Engineering Campus Placement 2026',
    drive_id: 'demo-drive-2026-campus',
    overall_score: 78,
    session_status: 'COMPLETED',
    candidate_outcome: 'INTERVIEW_SCHEDULED',
    isDemo: true,
    evaluation_logic: PRIYA_APTITUDE_REPORT,
    all_questions_and_answers: PRIYA_APTITUDE_REPORT.questionBreakdown,
    all_proctoring_events: [],
  },
  'demo-session-rohan': {
    id: 'demo-session-rohan',
    candidate_id: 'demo-cand-rohan',
    candidate_name: 'Rohan Verma',
    candidate_email: 'rohan.verma@example.com',
    drive_title: 'Engineering Campus Placement 2026',
    drive_id: 'demo-drive-2026-campus',
    overall_score: 91,
    session_status: 'COMPLETED',
    candidate_outcome: 'SHORTLIST',
    isDemo: true,
    evaluation_logic: ROHAN_CODING_REPORT,
    proctoringReport: ROHAN_PROCTORING_REPORT as any,
    all_questions_and_answers: ROHAN_CODING_REPORT.questionBreakdown,
    all_proctoring_events: ROHAN_PROCTORING_REPORT.violations,
  },
};

// ─── Merge generated bulk candidates (89 more to reach ~100 total) ─────────────
const { candidates: generatedCandidates, sessions: generatedSessions } = generateBulkDemoCandidates(89);
DEMO_CANDIDATES.push(...generatedCandidates);
Object.assign(DEMO_SESSIONS, generatedSessions);

// Update drive totals to reflect actual candidate count
DEMO_DRIVES.forEach(drive => {
  const count = DEMO_CANDIDATES.filter(c => c.driveId === drive.id).length;
  drive.total_candidates = count;
  drive.completed_candidates = count;
});
