import { JobPost, RoleSettings } from '../../../types';

export const JOB_ACCESS_KEYS = {
  CSE: 'CSE123',
  ETC: 'ETC123',
  DS: 'DS123',
  AI: 'AI123',
  CYBER: 'CYBER123',
  EE: 'EE123',
  ME: 'ME123',
  CE: 'CE123',
  IT: 'IT123',
  APTITUDE: 'APT123',
  TEST: 'test-key'
};

export const DEFAULT_SETTINGS: RoleSettings = {
  difficulty: 'Medium',
  preset: 'Normal',
  weights: {
    concept: 50,
    grammar: 20,
    fluency: 20,
    camera: 10
  },
  proctoring: {
    maxWarnings: 3,
    sensitivity: 'Medium',
    includeInScore: true
  }
};

export interface JobTemplate extends JobPost {
  role: string;
  assessmentType: 'VOICE_INTERVIEW' | 'MCQ';
  accessKey: string;
}

export const JOB_TEMPLATES: ReadonlyArray<JobTemplate> = Object.freeze([
  {
    id: 'template-cse',
    role: "CSE",
    title: "Computer Science Engineering (CSE)",
    description: "Core evaluation for Computer Science fundamentals, DBMS, OS, Networking, and DSA.",
    accessKey: JOB_ACCESS_KEYS.CSE,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS, difficulty: 'Hard', preset: 'Strict' },
    questions: [
      {
        id: 1,
        question: "What is the difference between a Process and a Thread?",
        difficulty: 'medium',
        category: 'Operating Systems',
        ideal_answer: "A process is an executing program (isolated); a thread is a unit of execution within a process (shared memory).",
        evaluationGuide: ["Memory isolation", "Shared resources", "Context switch"],
        maxScore: 10
      },
      {
        id: 2,
        question: "Explain the ACID properties in a Database Management System.",
        difficulty: 'medium',
        category: 'DBMS',
        ideal_answer: "Atomicity, Consistency, Isolation, Durability.",
        evaluationGuide: ["All or nothing", "Valid state", "Transaction independence", "Saved permanently"],
        maxScore: 10
      },
      {
        id: 3,
        question: "Describe the OSI model layers.",
        difficulty: 'hard',
        category: 'Networks',
        ideal_answer: "Physical, Data Link, Network, Transport, Session, Presentation, Application.",
        evaluationGuide: ["7 Layers", "Encapsulation", "Specific functions"],
        maxScore: 10
      },
      {
        id: 4,
        question: "How does Garbage Collection work in Java/Python?",
        difficulty: 'medium',
        category: 'Languages',
        ideal_answer: "Automatic memory management that reclaims memory used by objects no longer referenced.",
        evaluationGuide: ["Reference counting", "Reachability", "Memory leak prevention"],
        maxScore: 10
      },
      {
        id: 5,
        question: "What is the difference between TCP and UDP?",
        difficulty: 'medium',
        category: 'Networks',
        ideal_answer: "TCP is connection-oriented/reliable; UDP is connectionless/fast but unreliable.",
        evaluationGuide: ["Reliability", "Connection setup", "Speed"],
        maxScore: 10
      }
    ]
  },
  {
    id: 'template-etc',
    role: "ETC",
    title: "Electronics & Telecommunication Engineering (ETC)",
    description: "Core evaluation for Electronics, Embedded Systems, Signal Processing, and Circuits.",
    accessKey: JOB_ACCESS_KEYS.ETC,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-ds',
    role: "DS",
    title: "Data Science (DS)",
    description: "Core evaluation for Statistics, Machine Learning, Data Cleaning, and Analytics.",
    accessKey: JOB_ACCESS_KEYS.DS,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-ai',
    role: "AI",
    title: "Artificial Intelligence (AI)",
    description: "Core evaluation for Deep Learning, Neural Networks, NLP, and Computer Vision.",
    accessKey: JOB_ACCESS_KEYS.AI,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-cyber',
    role: "CYBER",
    title: "Cyber Security (CYBER)",
    description: "Core evaluation for Network Security, Cryptography, Incident Response, and Pentesting.",
    accessKey: JOB_ACCESS_KEYS.CYBER,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-ee',
    role: "EE",
    title: "Electrical Engineering (EE)",
    description: "Core evaluation for Power Systems, Electrical Machines, Control Systems, and AC/DC circuits.",
    accessKey: JOB_ACCESS_KEYS.EE,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-me',
    role: "ME",
    title: "Mechanical Engineering (ME)",
    description: "Core evaluation for Thermodynamics, Fluid Mechanics, FEA, Mechanical Design, and Materials.",
    accessKey: JOB_ACCESS_KEYS.ME,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS, difficulty: 'Medium', preset: 'Normal' },
    questions: [
      {
        id: 1,
        question: "Explain the Second Law of Thermodynamics and its practical implications.",
        difficulty: 'medium',
        category: 'Thermodynamics',
        ideal_answer: "The Second Law states that entropy of an isolated system always increases. Practically, it means heat cannot spontaneously flow from a cold body to a hot body, and no heat engine can have 100% efficiency.",
        evaluationGuide: ["Entropy increases", "Heat flow direction", "Efficiency limits"],
        maxScore: 10
      },
      {
        id: 2,
        question: "What is the difference between stress and strain?",
        difficulty: 'easy',
        category: 'Mechanics',
        ideal_answer: "Stress is force per unit area; strain is the deformation.",
        evaluationGuide: ["Force/Area", "Deformation"],
        maxScore: 10
      },
      {
        id: 3,
        question: "Describe the working principle of a 4-stroke petrol engine.",
        difficulty: 'medium',
        category: 'IC Engines',
        ideal_answer: "Intake, Compression, Power, Exhaust strokes.",
        evaluationGuide: ["4 strokes", "Spark plug", "Valves"],
        maxScore: 10
      },
      {
        id: 4,
        question: "What defines a fluid's viscosity?",
        difficulty: 'easy',
        category: 'Fluid Mechanics',
        ideal_answer: "Viscosity is a measure of a fluid's resistance to flow.",
        evaluationGuide: ["Resistance to flow", "Internal friction"],
        maxScore: 10
      },
      {
        id: 5,
        question: "Explain the purpose of heat treatment in metals.",
        difficulty: 'medium',
        category: 'Manufacturing',
        ideal_answer: "To alter physical/chemical properties (hardening, annealing).",
        evaluationGuide: ["Hardness", "Ductility", "Microstructure"],
        maxScore: 10
      }
    ]
  },
  {
    id: 'template-ce',
    role: "CE",
    title: "Civil Engineering (CE)",
    description: "Core evaluation for Structural Analysis, Concrete Technology, Geotechnical Engineering, and Hydraulics.",
    accessKey: JOB_ACCESS_KEYS.CE,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-it',
    role: "IT",
    title: "Information Technology (IT)",
    description: "Core evaluation for System Administration, Cloud Infrastructure, Networking, and IT Support.",
    accessKey: JOB_ACCESS_KEYS.IT,
    assessmentType: "VOICE_INTERVIEW",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'template-aptitude',
    role: "APTITUDE",
    title: "Aptitude",
    description: "Placement preparation and campus hiring aptitude test.",
    accessKey: JOB_ACCESS_KEYS.APTITUDE,
    assessmentType: "MCQ",
    company: 'REICREW',
    status: 'ACTIVE',
    mode: 'Custom',
    settings: { ...DEFAULT_SETTINGS },
    questions: []
  },
  {
    id: 'test-id',
    role: 'TEST',
    title: 'AI Software Engineer (Test)',
    description: 'General AI and Software Engineering test interview.',
    accessKey: JOB_ACCESS_KEYS.TEST,
    assessmentType: 'VOICE_INTERVIEW',
    company: 'REICREW AI TEST',
    status: 'ACTIVE',
    mode: 'AI',
    settings: { ...DEFAULT_SETTINGS, difficulty: 'Medium', preset: 'Normal' },
    questions: [
      {
        id: 1,
        question: "Explain the concept of Reactive programming in modern web development.",
        difficulty: 'medium',
        category: 'Web Dev',
        ideal_answer: "Reactive programming is a declarative programming paradigm concerned with data streams and the propagation of change.",
        evaluationGuide: ["Data streams", "Propagation of change", "Declarative"],
        maxScore: 10
      }
    ]
  }
]);

export function getJobTemplateByAccessKey(key: string): JobTemplate | null {
  return JOB_TEMPLATES.find(template => template.accessKey === key) || null;
}
