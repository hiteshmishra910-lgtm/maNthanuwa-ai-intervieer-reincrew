import { Question, InterviewRole, QuestionCategory, Difficulty } from "../../../types";

export const COMMON_QUESTION_BANK: Question[] = [
  {
    "id": "common_intro_001",
    "question": "Tell me about yourself.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Clear self-introduction including background, education, and skills",
      "Relevant areas of interest or career goals",
      "Professional and articulate communication"
    ],
    "keyConcepts": [
      {
        "concept": "Clear self-introduction including background, education, and skills",
        "importance": "high"
      },
      {
        "concept": "Relevant areas of interest or career goals",
        "importance": "high"
      },
      {
        "concept": "Professional and articulate communication",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Introduction",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_001",
    "question": "Describe a project you are most proud of.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_001",
    "question": "Tell me about a difficult bug you fixed.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_001",
    "question": "Describe a time you learned a new technology quickly.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_002",
    "question": "Tell me about a project that did not go as planned.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_002",
    "question": "Describe a challenging academic assignment.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_001",
    "question": "Tell me about a time you worked under pressure.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_002",
    "question": "Describe a time you solved a complex problem.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_003",
    "question": "Tell me about your final-year project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_001",
    "question": "Describe a time you worked with a difficult teammate.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_002",
    "question": "Tell me about a mistake you made and what you learned.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_003",
    "question": "Describe a time you took initiative.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_004",
    "question": "Tell me about a technical challenge you faced.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_005",
    "question": "Describe a time you had multiple deadlines.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_004",
    "question": "Tell me about your favorite programming project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_006",
    "question": "Describe a time you improved a process.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_003",
    "question": "Tell me about a time you received constructive criticism.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_005",
    "question": "Describe a successful team project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_007",
    "question": "Tell me about a leadership experience.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_002",
    "question": "Describe a time you had to explain a technical concept to a non-technical person.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_006",
    "question": "Tell me about a project where requirements changed midway.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_008",
    "question": "Describe a time you failed and recovered.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_009",
    "question": "Tell me about a difficult decision you made.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_003",
    "question": "Describe a time you helped a teammate.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_007",
    "question": "Tell me about a project where you exceeded expectations.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_004",
    "question": "Describe a time you handled conflict.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_010",
    "question": "Tell me about your biggest learning experience.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_011",
    "question": "Describe a time you managed limited resources.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_012",
    "question": "Tell me about a situation where you adapted quickly.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_008",
    "question": "Describe your most technically demanding project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific individual ownership and action details",
      "Learning takeaways and professional maturity"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific individual ownership and action details",
        "importance": "high"
      },
      {
        "concept": "Learning takeaways and professional maturity",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_004",
    "question": "What would you do if a teammate consistently missed deadlines?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_005",
    "question": "How would you handle disagreement with a team lead?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_003",
    "question": "What would you do if you discovered a critical bug before release?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_013",
    "question": "How would you respond if assigned an unfamiliar technology?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_009",
    "question": "What would you do if project requirements were unclear?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_014",
    "question": "How would you prioritize multiple urgent tasks?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_015",
    "question": "What would you do if a team member took credit for your work?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_006",
    "question": "How would you handle conflicting stakeholder requirements?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_016",
    "question": "What would you do if your solution was rejected?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_017",
    "question": "How would you approach an impossible deadline?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_018",
    "question": "What would you do if production went down at midnight?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_007",
    "question": "How would you handle receiving negative feedback?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_008",
    "question": "What would you do if you disagreed with a design decision?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_005",
    "question": "How would you mentor a struggling junior teammate?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_004",
    "question": "What would you do if you accidentally introduced a bug?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_019",
    "question": "How would you handle an uncooperative team member?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_020",
    "question": "What would you do if customer requirements kept changing?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_010",
    "question": "How would you react if your project failed?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_021",
    "question": "What would you do if you had insufficient information to proceed?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_009",
    "question": "How would you handle pressure from multiple managers?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_010",
    "question": "What would you do if a critical dependency was delayed?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_022",
    "question": "How would you respond to a security vulnerability discovery?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_023",
    "question": "What would you do if a customer complained about your product?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_011",
    "question": "How would you handle being assigned multiple projects?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_024",
    "question": "What would you do if your team missed a milestone?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_006",
    "question": "How would you manage communication in a remote team?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_025",
    "question": "What would you do if you found unethical behavior?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_026",
    "question": "How would you approach improving an outdated system?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_027",
    "question": "What would you do if your idea was ignored initially?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_011",
    "question": "How would you balance quality and speed under pressure?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active communication and proactive listening",
      "Professional conflict resolution or fallback planning steps",
      "Constructive output and system improvements delivery"
    ],
    "keyConcepts": [
      {
        "concept": "Active communication and proactive listening",
        "importance": "high"
      },
      {
        "concept": "Professional conflict resolution or fallback planning steps",
        "importance": "high"
      },
      {
        "concept": "Constructive output and system improvements delivery",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_012",
    "question": "Tell me about a challenging laboratory experiment.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_005",
    "question": "Describe a time you solved a technical problem.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_013",
    "question": "Tell me about a project where you learned a new tool or technology.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_014",
    "question": "Describe a project that did not go according to plan.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_015",
    "question": "Describe your final-year project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_028",
    "question": "Tell me about a time you improved a design.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_029",
    "question": "Describe a situation where you worked effectively in a team.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_016",
    "question": "Tell me about a mistake you made during a project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_030",
    "question": "Tell me about a difficult technical concept you mastered.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_017",
    "question": "Tell me about a successful academic project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_031",
    "question": "Describe a situation where you had to adapt quickly.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_012",
    "question": "Tell me about a time you received critical feedback.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_032",
    "question": "Describe a leadership experience.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_007",
    "question": "Tell me about a time you helped a teammate.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_018",
    "question": "Describe a project that required strong communication.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_033",
    "question": "Tell me about a challenge you faced while solving a technical issue.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_034",
    "question": "Describe a time you overcame resource limitations.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_019",
    "question": "Tell me about a project that required creativity.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_013",
    "question": "Describe a time you handled conflict within a team.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_020",
    "question": "Tell me about your most technically demanding project.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_008",
    "question": "Describe a time you had to explain a technical concept.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_021",
    "question": "Tell me about a project where requirements changed unexpectedly.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_035",
    "question": "Describe a failure and what you learned from it.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_036",
    "question": "Tell me about your biggest academic achievement.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_037",
    "question": "Describe an experience that significantly improved your technical skills.",
    "type": "Behavioral Experience",
    "difficulty": "medium",
    "evaluationGuide": [
      "Structured STAR method response (Situation, Task, Action, Result)",
      "Specific electronics/lab design and action details",
      "Technical learnings and project results outcome"
    ],
    "keyConcepts": [
      {
        "concept": "Structured STAR method response (Situation, Task, Action, Result)",
        "importance": "high"
      },
      {
        "concept": "Specific electronics/lab design and action details",
        "importance": "high"
      },
      {
        "concept": "Technical learnings and project results outcome",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_022",
    "question": "What would you do if a circuit failed just before a project demonstration?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_023",
    "question": "How would you handle disagreement with a project teammate?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_014",
    "question": "What would you do if you discovered a critical design flaw?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_009",
    "question": "How would you approach learning a new communication protocol quickly?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_038",
    "question": "How would you prioritize multiple urgent assignments?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_024",
    "question": "What would you do if your team missed a project deadline?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_039",
    "question": "How would you handle a team member not contributing equally?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_040",
    "question": "What would you do if your proposed solution was rejected?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_analy_006",
    "question": "How would you approach a technically challenging problem with limited guidance?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Analytical",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_041",
    "question": "What would you do if a prototype repeatedly failed testing?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_015",
    "question": "How would you react to negative feedback on your work?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_042",
    "question": "What would you do if your equipment was unavailable before an experiment?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_010",
    "question": "How would you mentor a junior teammate struggling with technical concepts?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_043",
    "question": "What would you do if you accidentally damaged a component during testing?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_comm_011",
    "question": "How would you handle communication issues within a team?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Communication",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_025",
    "question": "What would you do if project specifications changed midway?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_044",
    "question": "How would you respond if your design did not meet expectations?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_045",
    "question": "What would you do if you lacked sufficient information to proceed?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_026",
    "question": "How would you handle pressure during a critical project milestone?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_016",
    "question": "What would you do if a supplier delayed a critical component?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_046",
    "question": "How would you respond to a major system failure after deployment?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_047",
    "question": "What would you do if a customer reported reliability issues?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_027",
    "question": "How would you manage multiple projects simultaneously?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_sit_017",
    "question": "What would you do if your team disagreed on a technical approach?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Situational",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_028",
    "question": "How would you ensure effective communication in a remote project team?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_048",
    "question": "What would you do if you noticed unsafe engineering practices?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_049",
    "question": "How would you improve an outdated electronic system?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_beh_050",
    "question": "What would you do if your innovative idea was ignored initially?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Behavioral",
    "isActive": true,
    "version": 1
  },
  {
    "id": "common_proj_029",
    "question": "How would you balance quality, cost, and deadlines in an engineering project?",
    "type": "Behavioral Situation",
    "difficulty": "medium",
    "evaluationGuide": [
      "Collaborative communication and problem analysis steps",
      "Proposing mitigations and professional fallback plans",
      "Technical debugging approach and safety compliance details"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative communication and problem analysis steps",
        "importance": "high"
      },
      {
        "concept": "Proposing mitigations and professional fallback plans",
        "importance": "high"
      },
      {
        "concept": "Technical debugging approach and safety compliance details",
        "importance": "medium"
      }
    ],
    "role": "COMMON",
    "interviewCategory": "Project",
    "isActive": true,
    "version": 1
  }
];

export const TECHNICAL_BANKS: Record<InterviewRole, Question[]> = {
  CSE: [
  {
    "id": "cse_fund_001",
    "question": "What is an Array?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Contiguous memory layout",
        "importance": "high"
      },
      {
        "concept": "O(1) index-based access",
        "importance": "high"
      },
      {
        "concept": "Fixed size constraint",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_002",
    "question": "What is a Linked List?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Nodes containing data and pointers",
        "importance": "high"
      },
      {
        "concept": "Dynamic memory allocation",
        "importance": "high"
      },
      {
        "concept": "Sequential traversal access",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_003",
    "question": "What is the difference between an Array and a Linked List?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Contiguous vs non-contiguous memory allocation",
        "importance": "high"
      },
      {
        "concept": "O(1) random access vs O(N) sequential search",
        "importance": "high"
      },
      {
        "concept": "Dynamic size resizing overhead",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_004",
    "question": "What is a Stack?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "LIFO (Last In First Out) concept",
        "importance": "high"
      },
      {
        "concept": "Push and Pop execution",
        "importance": "high"
      },
      {
        "concept": "Call stack and undo operations use cases",
        "importance": "low"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_005",
    "question": "What is a Queue?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "FIFO (First In First Out) concept",
        "importance": "high"
      },
      {
        "concept": "Enqueue and Dequeue execution",
        "importance": "high"
      },
      {
        "concept": "Task scheduling and printer queue use cases",
        "importance": "low"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_006",
    "question": "What is the difference between Stack and Queue?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "LIFO vs FIFO logic differences",
        "importance": "high"
      },
      {
        "concept": "Push/Pop vs Enqueue/Dequeue operations",
        "importance": "high"
      },
      {
        "concept": "Underlying data structure implementations",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_007",
    "question": "What is a Variable?",
    "topic": "Programming",
    "category": "Programming",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Named storage space in RAM",
        "importance": "high"
      },
      {
        "concept": "Data types allocation constraints",
        "importance": "medium"
      },
      {
        "concept": "Value assignment and mutability",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_008",
    "question": "What is a Function?",
    "topic": "Programming",
    "category": "Programming",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Reusable modular block of code",
        "importance": "high"
      },
      {
        "concept": "Parameters inputs and return value outputs",
        "importance": "high"
      },
      {
        "concept": "Variable scope and isolation",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_009",
    "question": "What is a Class in Object-Oriented Programming?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Blueprint template for creating objects",
        "importance": "high"
      },
      {
        "concept": "Attributes and methods binding",
        "importance": "high"
      },
      {
        "concept": "Instantiation process",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_010",
    "question": "What is an Object?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Instance of a class containing state",
        "importance": "high"
      },
      {
        "concept": "State variables and behavior methods",
        "importance": "high"
      },
      {
        "concept": "Memory allocation on the heap",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_011",
    "question": "What are the four pillars of OOP?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Encapsulation for data hiding",
        "importance": "high"
      },
      {
        "concept": "Inheritance for code reusability",
        "importance": "high"
      },
      {
        "concept": "Polymorphism for dynamic binding",
        "importance": "high"
      },
      {
        "concept": "Abstraction for interface simplicity",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_012",
    "question": "What is Inheritance?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Parent-child relationship code sharing",
        "importance": "high"
      },
      {
        "concept": "Subclass extending superclass base",
        "importance": "high"
      },
      {
        "concept": "Is-a relationship design",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_013",
    "question": "What is Polymorphism?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Single interface with multiple forms",
        "importance": "high"
      },
      {
        "concept": "Compile-time overloading vs runtime overriding",
        "importance": "high"
      },
      {
        "concept": "Virtual methods dynamic dispatch",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_014",
    "question": "What is Encapsulation?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Data hiding using access specifiers",
        "importance": "high"
      },
      {
        "concept": "Getter and setter control boundaries",
        "importance": "medium"
      },
      {
        "concept": "Bundling variables and functions",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_015",
    "question": "What is Abstraction?",
    "topic": "OOP",
    "category": "OOP",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Hiding system implementation details",
        "importance": "high"
      },
      {
        "concept": "Abstract classes and interface contracts",
        "importance": "high"
      },
      {
        "concept": "Reducing developer cognitive load",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_016",
    "question": "What is a Database?",
    "topic": "Database",
    "category": "Database",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Structured data storage and persistence",
        "importance": "high"
      },
      {
        "concept": "DBMS management utility software",
        "importance": "medium"
      },
      {
        "concept": "Transactional storage integrity",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_017",
    "question": "What is SQL?",
    "topic": "Database",
    "category": "Database",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Structured Query Language standard",
        "importance": "high"
      },
      {
        "concept": "Relational tabular model schema",
        "importance": "high"
      },
      {
        "concept": "Data definition (DDL) and manipulation (DML)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_018",
    "question": "What is a Primary Key?",
    "topic": "Database",
    "category": "Database",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Unique row index identifier",
        "importance": "high"
      },
      {
        "concept": "Non-null values constraint",
        "importance": "high"
      },
      {
        "concept": "Single primary key per table limit",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_019",
    "question": "What is a Foreign Key?",
    "topic": "Database",
    "category": "Database",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Referential integrity constraint link",
        "importance": "high"
      },
      {
        "concept": "Mapping table relationships",
        "importance": "high"
      },
      {
        "concept": "Child table referencing parent table",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_020",
    "question": "What is Normalization?",
    "topic": "Database",
    "category": "Database",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Redundancy reduction methodology",
        "importance": "high"
      },
      {
        "concept": "1NF, 2NF, and 3NF normal forms",
        "importance": "high"
      },
      {
        "concept": "Anomalies prevention (insert, update, delete)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_021",
    "question": "What is an Operating System?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Hardware resources allocator kernel",
        "importance": "high"
      },
      {
        "concept": "Abstraction layer for user applications",
        "importance": "high"
      },
      {
        "concept": "Process and memory manager roles",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_022",
    "question": "What is a Process?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Active program in execution",
        "importance": "high"
      },
      {
        "concept": "Isolated memory address boundaries",
        "importance": "high"
      },
      {
        "concept": "Process Control Block tracking data",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_023",
    "question": "What is a Thread?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Lightweight execution stream in process",
        "importance": "high"
      },
      {
        "concept": "Shared memory within process",
        "importance": "high"
      },
      {
        "concept": "Thread scheduling and context switching",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_024",
    "question": "What is RAM?",
    "topic": "Computer Architecture",
    "category": "Hardware",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Random Access Memory execution space",
        "importance": "high"
      },
      {
        "concept": "Volatile temporary storage state",
        "importance": "high"
      },
      {
        "concept": "Direct byte addressing reads/writes",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_025",
    "question": "What is ROM?",
    "topic": "Computer Architecture",
    "category": "Hardware",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Read Only Memory firmware storage",
        "importance": "high"
      },
      {
        "concept": "Non-volatile permanent state retention",
        "importance": "high"
      },
      {
        "concept": "BIOS boot instruction records",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_026",
    "question": "What is an API?",
    "topic": "Software Engineering",
    "category": "Software Engineering",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Application Programming Interface contract",
        "importance": "high"
      },
      {
        "concept": "Service integration endpoints",
        "importance": "high"
      },
      {
        "concept": "Payload formats (JSON, XML)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_027",
    "question": "What is HTTP?",
    "topic": "Networking",
    "category": "Networking",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Hypertext Transfer Protocol stateless system",
        "importance": "high"
      },
      {
        "concept": "Request-response cycle mechanism",
        "importance": "high"
      },
      {
        "concept": "Port 80 standard endpoint connection",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_028",
    "question": "What is HTTPS?",
    "topic": "Networking",
    "category": "Networking",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Secure HTTP utilizing SSL/TLS",
        "importance": "high"
      },
      {
        "concept": "Encrypted communication tunnel transit",
        "importance": "high"
      },
      {
        "concept": "Port 443 standard endpoint connection",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_029",
    "question": "What is DNS?",
    "topic": "Networking",
    "category": "Networking",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Domain Name System resolution lookup",
        "importance": "high"
      },
      {
        "concept": "Hostnames translation to IP addresses",
        "importance": "high"
      },
      {
        "concept": "Hierarchical distributed database scaling",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_fund_030",
    "question": "What is Cloud Computing?",
    "topic": "Cloud Computing",
    "category": "Cloud",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "On-demand internet virtual resources",
        "importance": "high"
      },
      {
        "concept": "IaaS, PaaS, SaaS service tiers",
        "importance": "high"
      },
      {
        "concept": "Shared responsibility model guidelines",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_001",
    "question": "Explain the difference between SQL and NoSQL databases.",
    "topic": "Database",
    "category": "Database",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Relational schemas vs dynamic key-value/document stores",
        "importance": "high"
      },
      {
        "concept": "ACID tabular constraints vs CAP theorem considerations",
        "importance": "high"
      },
      {
        "concept": "Vertical vs horizontal scalability scaling patterns",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_002",
    "question": "Explain the concept of Database Indexing.",
    "topic": "Database",
    "category": "Database",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Query search times reduction index structures",
        "importance": "high"
      },
      {
        "concept": "B-Tree and Hash index underlying mechanics",
        "importance": "medium"
      },
      {
        "concept": "Write penalty overhead during inserts/updates",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_003",
    "question": "What are ACID properties?",
    "topic": "Database",
    "category": "Database",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Atomicity, Consistency, Isolation, Durability specifications",
        "importance": "high"
      },
      {
        "concept": "Transactional integrity checks",
        "importance": "high"
      },
      {
        "concept": "Rollback and locking isolation levels",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_004",
    "question": "What is Database Denormalization?",
    "topic": "Database",
    "category": "Database",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Inserting redundant duplicates to accelerate reads",
        "importance": "high"
      },
      {
        "concept": "Read optimization vs write complexity overhead",
        "importance": "high"
      },
      {
        "concept": "Data consistency management strategies",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_005",
    "question": "What is Multithreading?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Concurrent execution paths inside single process context",
        "importance": "high"
      },
      {
        "concept": "Shared process heap memory communication",
        "importance": "high"
      },
      {
        "concept": "Race conditions and locking/synchronization checks",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_006",
    "question": "What is a Deadlock?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Core",
    "difficulty": "hard",
    "discriminationWeight": 1.5,
    "keyConcepts": [
      {
        "concept": "Mutual exclusion, hold and wait, no preemption, circular wait",
        "importance": "high"
      },
      {
        "concept": "Deadlock detection and resource allocation graph checks",
        "importance": "medium"
      },
      {
        "concept": "Prevention strategies (ordering locks, timeouts)",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_007",
    "question": "Explain Process Scheduling.",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "CPU core allocation scheduler algorithms",
        "importance": "high"
      },
      {
        "concept": "Preemptive vs non-preemptive processes execution",
        "importance": "medium"
      },
      {
        "concept": "FCFS, Round Robin, Shortest Job First mechanics",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_008",
    "question": "What is Virtual Memory?",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Disk space utilization as temporary physical RAM",
        "importance": "high"
      },
      {
        "concept": "Page faults and swapping management",
        "importance": "high"
      },
      {
        "concept": "TLB and hardware MMU translation",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_009",
    "question": "Explain Paging and Segmentation.",
    "topic": "Operating Systems",
    "category": "OS",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Fixed physical page allocations vs logical segments",
        "importance": "high"
      },
      {
        "concept": "Internal fragmentation in paging vs external fragmentation in segmentation",
        "importance": "high"
      },
      {
        "concept": "Memory protection bits on addresses",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_010",
    "question": "What is a Hash Table?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Hash function index hashing translation",
        "importance": "high"
      },
      {
        "concept": "Average O(1) time complexity for lookup/insert",
        "importance": "high"
      },
      {
        "concept": "Collision resolution via chaining or open addressing",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_011",
    "question": "What is Time Complexity?",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Instruction execution count growth scaling",
        "importance": "high"
      },
      {
        "concept": "Asymptotic upper bounds estimations",
        "importance": "high"
      },
      {
        "concept": "Worst, average, and best-case performance analysis",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_012",
    "question": "Explain Big O Notation.",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Mathematical worst-case upper bound notation",
        "importance": "high"
      },
      {
        "concept": "Ignoring constant coefficients and smaller growth variables",
        "importance": "high"
      },
      {
        "concept": "Common complexity scales: O(1), O(log N), O(N), O(N^2)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_013",
    "question": "What is Recursion?",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Function self-calling structure mechanics",
        "importance": "high"
      },
      {
        "concept": "Base case exit condition requirement",
        "importance": "high"
      },
      {
        "concept": "Stack frame memory consumption and stack overflows",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_014",
    "question": "What is Dynamic Programming?",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "hard",
    "discriminationWeight": 1.5,
    "keyConcepts": [
      {
        "concept": "Overlapping subproblems property",
        "importance": "high"
      },
      {
        "concept": "Optimal substructure composition property",
        "importance": "high"
      },
      {
        "concept": "Top-down memoization vs bottom-up tabulation",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_015",
    "question": "Explain Binary Search.",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sorted array prerequisite",
        "importance": "high"
      },
      {
        "concept": "Logarithmic search division O(log N)",
        "importance": "high"
      },
      {
        "concept": "Divide-and-conquer implementation framework",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_016",
    "question": "What is a Tree Data Structure?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Hierarchical node configuration",
        "importance": "high"
      },
      {
        "concept": "Root, leaf, parent, child definitions",
        "importance": "medium"
      },
      {
        "concept": "Acyclic tree properties",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_017",
    "question": "What is a Binary Search Tree?",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sorted array prerequisite",
        "importance": "high"
      },
      {
        "concept": "Logarithmic search division O(log N)",
        "importance": "high"
      },
      {
        "concept": "Divide-and-conquer implementation framework",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_018",
    "question": "What is a Graph Data Structure?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Node vertices connected by edge lines",
        "importance": "high"
      },
      {
        "concept": "Adjacency matrix vs adjacency list structures",
        "importance": "high"
      },
      {
        "concept": "Directed vs undirected paths properties",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_019",
    "question": "Explain BFS and DFS.",
    "topic": "Algorithms",
    "category": "DSA",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Queue-based level-order search (BFS)",
        "importance": "high"
      },
      {
        "concept": "Stack/recursion-based depth search (DFS)",
        "importance": "high"
      },
      {
        "concept": "O(V + E) node traversal complexities",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_020",
    "question": "What is a REST API?",
    "topic": "Web Development",
    "category": "Software Engineering",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Stateless client-server HTTP communications",
        "importance": "high"
      },
      {
        "concept": "Standard CRUD methods mapping (GET, POST, PUT, DELETE)",
        "importance": "high"
      },
      {
        "concept": "URI resource mapping structures",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_021",
    "question": "What is GraphQL?",
    "topic": "Data Structures",
    "category": "DSA",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Node vertices connected by edge lines",
        "importance": "high"
      },
      {
        "concept": "Adjacency matrix vs adjacency list structures",
        "importance": "high"
      },
      {
        "concept": "Directed vs undirected paths properties",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_022",
    "question": "What is Authentication and Authorization?",
    "topic": "Security",
    "category": "Software Engineering",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Identity mapping verification (Authentication) vs access rights checks (Authorization)",
        "importance": "high"
      },
      {
        "concept": "Token mechanisms (JWT, OAuth) vs session cookie tracking",
        "importance": "high"
      },
      {
        "concept": "HTTP status codes rules (401 vs 403 response types)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_023",
    "question": "Explain JWT.",
    "topic": "Security",
    "category": "Software Engineering",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Header, payload, and cryptographic signature segments",
        "importance": "high"
      },
      {
        "concept": "Stateless claims transmission",
        "importance": "high"
      },
      {
        "concept": "Token encryption vs signing properties",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_024",
    "question": "What is Microservices Architecture?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Core",
    "difficulty": "hard",
    "discriminationWeight": 1.5,
    "keyConcepts": [
      {
        "concept": "Decoupled bounded-context services",
        "importance": "high"
      },
      {
        "concept": "API gateway routing architecture",
        "importance": "medium"
      },
      {
        "concept": "Distributed data consistency challenges (Saga, Eventual consistency)",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_025",
    "question": "What is a Monolithic Architecture?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Core",
    "difficulty": "hard",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Single codebase compiled and deployed unit",
        "importance": "high"
      },
      {
        "concept": "Simplified local debugging and pipeline testing",
        "importance": "medium"
      },
      {
        "concept": "Scaling bottlenecks and codebase ownership scaling issues",
        "importance": "high"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_026",
    "question": "What is Containerization?",
    "topic": "DevOps",
    "category": "Cloud",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Packaging code with dependency runtime environments",
        "importance": "high"
      },
      {
        "concept": "Lightweight kernel-sharing namespace isolation",
        "importance": "high"
      },
      {
        "concept": "Consistency across dev/staging/production pipelines",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_027",
    "question": "What is Docker?",
    "topic": "DevOps",
    "category": "Cloud",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Docker image building rules (Dockerfile instructions)",
        "importance": "high"
      },
      {
        "concept": "Container isolation runtime parameters",
        "importance": "high"
      },
      {
        "concept": "Layer caching optimization mechanisms",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_028",
    "question": "What is CI/CD?",
    "topic": "DevOps",
    "category": "Cloud",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Continuous integration automated tests triggers",
        "importance": "high"
      },
      {
        "concept": "Continuous deployment pipeline automated delivery",
        "importance": "high"
      },
      {
        "concept": "Artifact repository version control integrations",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_029",
    "question": "What is Load Balancing?",
    "topic": "DevOps",
    "category": "Cloud",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Traffic allocation algorithms (Round Robin, Least Connections)",
        "importance": "high"
      },
      {
        "concept": "High availability cluster health checks",
        "importance": "high"
      },
      {
        "concept": "Layer 4 transport vs Layer 7 application routing",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_core_030",
    "question": "What is Caching?",
    "topic": "Performance",
    "category": "Cloud",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Temporary memory caching data layer (Redis, Memcached)",
        "importance": "high"
      },
      {
        "concept": "Cache eviction strategies (LRU, LFU, TTL configurations)",
        "importance": "high"
      },
      {
        "concept": "Cache stampede and consistency challenges",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_001",
    "question": "A website becomes slow during peak traffic. How would you investigate?",
    "topic": "Performance Optimization",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Bottleneck profiling and APM logs analysis",
        "importance": "high"
      },
      {
        "concept": "Database indexing or caching optimizations",
        "importance": "high"
      },
      {
        "concept": "Payload sizes compression or lazy loading",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_002",
    "question": "A database query takes 20 seconds to execute. How would you optimize it?",
    "topic": "Database Systems",
    "category": "Database",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Query optimization (EXPLAIN command, indexing)",
        "importance": "high"
      },
      {
        "concept": "Idempotency locks or isolation level constraints",
        "importance": "high"
      },
      {
        "concept": "Audit logs checks and transaction history rollback",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_003",
    "question": "Users report frequent application crashes. How would you debug the issue?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_004",
    "question": "How would you design a URL shortening service?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_005",
    "question": "How would you design an online library management system?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_006",
    "question": "A login page is vulnerable to attacks. How would you secure it?",
    "topic": "Security",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Cryptographic password hashing (bcrypt, Argon2)",
        "importance": "high"
      },
      {
        "concept": "Input validation and SQL Injection/XSS prevention",
        "importance": "high"
      },
      {
        "concept": "Rate limiting implementation and brute force protection",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_007",
    "question": "A website loads slowly on mobile devices. How would you improve performance?",
    "topic": "Performance Optimization",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Bottleneck profiling and APM logs analysis",
        "importance": "high"
      },
      {
        "concept": "Database indexing or caching optimizations",
        "importance": "high"
      },
      {
        "concept": "Payload sizes compression or lazy loading",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_008",
    "question": "How would you handle millions of API requests per day?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Functional requirements mapping",
        "importance": "high"
      },
      {
        "concept": "Scalability and data flow layout",
        "importance": "high"
      },
      {
        "concept": "Trade-offs between different architectural approaches",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_009",
    "question": "How would you design a simple chat application?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_010",
    "question": "A server suddenly runs out of memory. What would you do?",
    "topic": "Troubleshooting",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Heap dump analytics or logs inspection",
        "importance": "high"
      },
      {
        "concept": "Memory leak tracing or circuit breaker pattern",
        "importance": "high"
      },
      {
        "concept": "Isolating failing components locally",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_011",
    "question": "How would you reduce database load in a large application?",
    "topic": "Database Systems",
    "category": "Database",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Query optimization (EXPLAIN command, indexing)",
        "importance": "high"
      },
      {
        "concept": "Idempotency locks or isolation level constraints",
        "importance": "high"
      },
      {
        "concept": "Audit logs checks and transaction history rollback",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_012",
    "question": "How would you store and retrieve large files efficiently?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Functional requirements mapping",
        "importance": "high"
      },
      {
        "concept": "Scalability and data flow layout",
        "importance": "high"
      },
      {
        "concept": "Trade-offs between different architectural approaches",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_013",
    "question": "Design a simple e-commerce backend.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_014",
    "question": "How would you prevent duplicate transactions in an online payment system?",
    "topic": "Database Systems",
    "category": "Database",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Query optimization (EXPLAIN command, indexing)",
        "importance": "high"
      },
      {
        "concept": "Idempotency locks or isolation level constraints",
        "importance": "high"
      },
      {
        "concept": "Audit logs checks and transaction history rollback",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_015",
    "question": "A customer reports missing data. How would you investigate?",
    "topic": "Database Systems",
    "category": "Database",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Query optimization (EXPLAIN command, indexing)",
        "importance": "high"
      },
      {
        "concept": "Idempotency locks or isolation level constraints",
        "importance": "high"
      },
      {
        "concept": "Audit logs checks and transaction history rollback",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_016",
    "question": "How would you improve website scalability?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Functional requirements mapping",
        "importance": "high"
      },
      {
        "concept": "Scalability and data flow layout",
        "importance": "high"
      },
      {
        "concept": "Trade-offs between different architectural approaches",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_017",
    "question": "Design a notification system for a social media platform.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_018",
    "question": "How would you monitor production system health?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_019",
    "question": "How would you handle application logs in a large system?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_020",
    "question": "Design a simple ride-booking application.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_021",
    "question": "How would you secure user passwords?",
    "topic": "Security",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Cryptographic password hashing (bcrypt, Argon2)",
        "importance": "high"
      },
      {
        "concept": "Input validation and SQL Injection/XSS prevention",
        "importance": "high"
      },
      {
        "concept": "Rate limiting implementation and brute force protection",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_022",
    "question": "A third-party API becomes unavailable. What would you do?",
    "topic": "Troubleshooting",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Heap dump analytics or logs inspection",
        "importance": "high"
      },
      {
        "concept": "Memory leak tracing or circuit breaker pattern",
        "importance": "high"
      },
      {
        "concept": "Isolating failing components locally",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_023",
    "question": "How would you implement rate limiting?",
    "topic": "Security",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Cryptographic password hashing (bcrypt, Argon2)",
        "importance": "high"
      },
      {
        "concept": "Input validation and SQL Injection/XSS prevention",
        "importance": "high"
      },
      {
        "concept": "Rate limiting implementation and brute force protection",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_024",
    "question": "Design a file-sharing platform.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_025",
    "question": "How would you detect performance bottlenecks?",
    "topic": "Performance Optimization",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Bottleneck profiling and APM logs analysis",
        "importance": "high"
      },
      {
        "concept": "Database indexing or caching optimizations",
        "importance": "high"
      },
      {
        "concept": "Payload sizes compression or lazy loading",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_026",
    "question": "Design a student attendance management system.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_027",
    "question": "How would you handle concurrent database updates?",
    "topic": "Database Systems",
    "category": "Database",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Query optimization (EXPLAIN command, indexing)",
        "importance": "high"
      },
      {
        "concept": "Idempotency locks or isolation level constraints",
        "importance": "high"
      },
      {
        "concept": "Audit logs checks and transaction history rollback",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_028",
    "question": "Design a movie ticket booking system.",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_029",
    "question": "How would you improve API response times?",
    "topic": "Performance Optimization",
    "category": "Software Engineering",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Bottleneck profiling and APM logs analysis",
        "importance": "high"
      },
      {
        "concept": "Database indexing or caching optimizations",
        "importance": "high"
      },
      {
        "concept": "Payload sizes compression or lazy loading",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cse_scen_030",
    "question": "How would you design a scalable search system?",
    "topic": "System Design",
    "category": "System Design",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Component separation and API interface design",
        "importance": "high"
      },
      {
        "concept": "Scaling limits resolution (load balancing, caching)",
        "importance": "high"
      },
      {
        "concept": "Database technology selection (SQL vs NoSQL)",
        "importance": "medium"
      }
    ],
    "role": "CSE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  ETC: [
  {
    "id": "etc_fund_001",
    "question": "What is Ohm's Law?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "V = IR voltage-current proportionality",
        "importance": "high"
      },
      {
        "concept": "Limitation to constant temperature/ohmic devices",
        "importance": "high"
      },
      {
        "concept": "Linear resistance definition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_002",
    "question": "What is Voltage?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Electric potential difference",
        "importance": "high"
      },
      {
        "concept": "Electromotive force push",
        "importance": "medium"
      },
      {
        "concept": "Work done per unit charge (Joules/Coulomb)",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_003",
    "question": "What is Current?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Flow rate of electric charge (Coulombs/sec)",
        "importance": "high"
      },
      {
        "concept": "Amperes unit definition",
        "importance": "medium"
      },
      {
        "concept": "Drift velocity of charge carriers",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_004",
    "question": "What is Resistance?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Opposition to electric current flow",
        "importance": "high"
      },
      {
        "concept": "Resistivity and conductor physical dimension laws",
        "importance": "high"
      },
      {
        "concept": "Ohm unit definition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_005",
    "question": "What is Power in an electrical circuit?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Rate of electrical energy dissipation",
        "importance": "high"
      },
      {
        "concept": "P = VI and current-squared times resistance derivatives",
        "importance": "high"
      },
      {
        "concept": "Watts unit definition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_006",
    "question": "What is the function of a resistor?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Current limitation role",
        "importance": "high"
      },
      {
        "concept": "Voltage division circuit configuration",
        "importance": "high"
      },
      {
        "concept": "Joule heating power dissipation",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_007",
    "question": "What is the function of a capacitor?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Electrostatic field charge storage",
        "importance": "high"
      },
      {
        "concept": "Blocking DC current and passing AC signals",
        "importance": "high"
      },
      {
        "concept": "Filtering supply voltage ripples",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_008",
    "question": "What is the function of an inductor?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Magnetic field energy storage",
        "importance": "high"
      },
      {
        "concept": "Blocking high-frequency AC and passing DC signals",
        "importance": "high"
      },
      {
        "concept": "Choke filtering application",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_009",
    "question": "What is a transistor?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Active three-terminal semiconductor device",
        "importance": "high"
      },
      {
        "concept": "Signal amplification functionality",
        "importance": "medium"
      },
      {
        "concept": "Electronic switching functionality",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_010",
    "question": "What is a diode?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Unidirectional current flow control",
        "importance": "high"
      },
      {
        "concept": "PN junction potential barrier",
        "importance": "medium"
      },
      {
        "concept": "Rectification and protection applications",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_011",
    "question": "What is the difference between AC and DC current?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Alternating current bi-directional flow vs direct current uni-directional flow",
        "importance": "high"
      },
      {
        "concept": "Frequency component in AC supply",
        "importance": "medium"
      },
      {
        "concept": "Power transmission grids efficiency differences",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_012",
    "question": "What is the difference between Analog and Digital Signals?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Continuous electrical values vs discrete binary levels",
        "importance": "high"
      },
      {
        "concept": "Noise susceptibility differences (analog is higher)",
        "importance": "high"
      },
      {
        "concept": "Processing and compression advantages",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_013",
    "question": "What is Frequency?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Cycles completed per second (Hertz)",
        "importance": "high"
      },
      {
        "concept": "Inverse relationship to time period (T = 1/f)",
        "importance": "high"
      },
      {
        "concept": "Spectrum allocation and bandwidth",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_014",
    "question": "What is Wavelength?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Physical distance between identical wave points",
        "importance": "high"
      },
      {
        "concept": "Inverse relationship to frequency (c = f * lambda)",
        "importance": "high"
      },
      {
        "concept": "Antenna dimensions calculation relevance",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_015",
    "question": "What is Amplitude?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Maximum peak height displacement",
        "importance": "high"
      },
      {
        "concept": "Signal strength and power representation",
        "importance": "high"
      },
      {
        "concept": "Power relation to amplitude squared",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_016",
    "question": "What is Modulation?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "medium",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Superimposing message on high-frequency carrier wave",
        "importance": "high"
      },
      {
        "concept": "Information transmission over long distances",
        "importance": "high"
      },
      {
        "concept": "Antenna sizing reduction",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_017",
    "question": "What is Demodulation?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Extracting source message from modulated carrier wave",
        "importance": "high"
      },
      {
        "concept": "Receiver stage filtering and detection",
        "importance": "high"
      },
      {
        "concept": "Envelope detector and synchronous detection methods",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_018",
    "question": "What is Bandwidth?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Range of frequencies allocated in transmission medium",
        "importance": "high"
      },
      {
        "concept": "Information carrying capacity limitation",
        "importance": "high"
      },
      {
        "concept": "Shannon-Hartley theorem capacity",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_019",
    "question": "What is Impedance?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Total AC opposition (Z = R + jX)",
        "importance": "high"
      },
      {
        "concept": "Resistive part and reactive component",
        "importance": "medium"
      },
      {
        "concept": "Maximum power transfer impedance matching requirement",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_020",
    "question": "What is Signal Attenuation?",
    "topic": "Signals",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Signal strength loss through propagation medium",
        "importance": "high"
      },
      {
        "concept": "Decibels per unit length scaling",
        "importance": "medium"
      },
      {
        "concept": "Repeater and amplifier gain requirements",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_021",
    "question": "What is a Microprocessor?",
    "topic": "Digital Systems",
    "category": "Embedded",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Central processing unit on single IC chip",
        "importance": "high"
      },
      {
        "concept": "Requires external memory and input/output interfaces",
        "importance": "high"
      },
      {
        "concept": "General-purpose high-performance processing focus",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_022",
    "question": "What is a Microcontroller?",
    "topic": "Digital Systems",
    "category": "Embedded",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "CPU, RAM, ROM, and I/O integrated on one chip",
        "importance": "high"
      },
      {
        "concept": "Dedicated control applications execution focus",
        "importance": "high"
      },
      {
        "concept": "Low power and resource constraints profile",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_023",
    "question": "What is an Integrated Circuit (IC)?",
    "topic": "Components",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Microscopic silicon wafer chip integrating elements",
        "importance": "high"
      },
      {
        "concept": "VLSI component density scaling",
        "importance": "medium"
      },
      {
        "concept": "Monolithic fabrication process",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_024",
    "question": "What is a PCB?",
    "topic": "Manufacturing",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Printed Circuit Board etching tracks",
        "importance": "high"
      },
      {
        "concept": "FR4 mechanical substrate support",
        "importance": "medium"
      },
      {
        "concept": "Copper layers and solder mask routing",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_025",
    "question": "What is an Antenna?",
    "topic": "Electromagnetics",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Guided wave to space electromagnetic wave transducer",
        "importance": "high"
      },
      {
        "concept": "Radiation pattern and directional gain",
        "importance": "high"
      },
      {
        "concept": "Impedance matching parameters",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_026",
    "question": "What is Electromagnetic Interference (EMI)?",
    "topic": "Electromagnetics",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Electromagnetic disturbance in circuits",
        "importance": "high"
      },
      {
        "concept": "Crosstalk or noise distortions",
        "importance": "medium"
      },
      {
        "concept": "Grounding plane and metallic shielding protection",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_027",
    "question": "What is Signal-to-Noise Ratio (SNR)?",
    "topic": "Signals",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Signal power divided by noise power ratio",
        "importance": "high"
      },
      {
        "concept": "Decibel logarithmic scale",
        "importance": "medium"
      },
      {
        "concept": "Channel communication quality threshold",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_028",
    "question": "What is ADC (Analog-to-Digital Converter)?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Sampling analog signal and quantizing values",
        "importance": "high"
      },
      {
        "concept": "Nyquist sampling theorem rules",
        "importance": "high"
      },
      {
        "concept": "Resolution in bits (quantization levels)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_029",
    "question": "What is DAC (Digital-to-Analog Converter)?",
    "topic": "Signals",
    "category": "Core Electronics",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Digital code binary conversion to analog voltages",
        "importance": "high"
      },
      {
        "concept": "Resolution step size weightings",
        "importance": "medium"
      },
      {
        "concept": "Reconstruction low-pass filters usage",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_fund_030",
    "question": "What is a Communication System?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Fundamentals",
    "difficulty": "easy",
    "discriminationWeight": 0.8,
    "keyConcepts": [
      {
        "concept": "Transmitter, channel, and receiver blocks stages",
        "importance": "high"
      },
      {
        "concept": "Source coding and channel coding operations",
        "importance": "medium"
      },
      {
        "concept": "Signal modulation and noise parameters",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_001",
    "question": "Explain the working principle of a PN Junction Diode.",
    "topic": "Semiconductors",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Depletion region barrier potential",
        "importance": "high"
      },
      {
        "concept": "Forward bias diffusion current flow",
        "importance": "high"
      },
      {
        "concept": "Reverse bias depletion expansion and leakage current",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_002",
    "question": "What is a Zener Diode and where is it used?",
    "topic": "Semiconductors",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Zener and Avalanche breakdown reverse bias mechanisms",
        "importance": "high"
      },
      {
        "concept": "Constant voltage reference characteristics",
        "importance": "high"
      },
      {
        "concept": "Shunt voltage regulation circuit designs",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_003",
    "question": "Explain the working of a Bipolar Junction Transistor (BJT).",
    "topic": "Semiconductors",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Emitter, base, and collector regions",
        "importance": "high"
      },
      {
        "concept": "Current-controlled bipolar current source BJT",
        "importance": "high"
      },
      {
        "concept": "Active, saturation, and cut-off operation regions",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_004",
    "question": "What is a MOSFET?",
    "topic": "Semiconductors",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Voltage-controlled field effect transistor gates",
        "importance": "high"
      },
      {
        "concept": "High gate input impedance gate isolation",
        "importance": "high"
      },
      {
        "concept": "Gate, source, drain, and bulk terminals",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_005",
    "question": "Explain the operation of an Operational Amplifier.",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "High gain differential voltage amplifier stage",
        "importance": "high"
      },
      {
        "concept": "Inverting and non-inverting feedback topologies",
        "importance": "high"
      },
      {
        "concept": "Virtual ground concept in negative feedback",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_006",
    "question": "What are the characteristics of an ideal Op-Amp?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "High gain differential voltage amplifier stage",
        "importance": "high"
      },
      {
        "concept": "Inverting and non-inverting feedback topologies",
        "importance": "high"
      },
      {
        "concept": "Virtual ground concept in negative feedback",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_007",
    "question": "Explain AM Modulation.",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Carrier amplitude varied with message voltage",
        "importance": "high"
      },
      {
        "concept": "Upper and lower sidebands spectrum structure",
        "importance": "medium"
      },
      {
        "concept": "Modulation index calculation and envelope detector",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_008",
    "question": "Explain FM Modulation.",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Carrier frequency varied with message voltage",
        "importance": "high"
      },
      {
        "concept": "Frequency deviation ratio parameters",
        "importance": "medium"
      },
      {
        "concept": "High noise immunity advantages compared to AM",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_009",
    "question": "Compare AM and FM.",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "AM narrow bandwidth vs FM wider bandwidth requirements",
        "importance": "high"
      },
      {
        "concept": "Noise immunity performance comparisons",
        "importance": "high"
      },
      {
        "concept": "Circuit complexity differences",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_010",
    "question": "What is Pulse Code Modulation (PCM)?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sampling, quantization, and binary encoding stages",
        "importance": "high"
      },
      {
        "concept": "Nyquist sampling theorem minimum rate limit",
        "importance": "high"
      },
      {
        "concept": "Quantization error noise generation",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_011",
    "question": "What is Multiplexing?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Channel sharing among multiple message sources",
        "importance": "high"
      },
      {
        "concept": "Multiplexers and demultiplexers routing",
        "importance": "high"
      },
      {
        "concept": "Efficiency optimization of medium bandwidth",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_012",
    "question": "Explain Time Division Multiplexing (TDM).",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sharing channel based on distinct time slots allocations",
        "importance": "high"
      },
      {
        "concept": "Digital signals multiplexing frames",
        "importance": "medium"
      },
      {
        "concept": "Sender-receiver synchronization tracking necessity",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_013",
    "question": "Explain Frequency Division Multiplexing (FDM).",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sharing channel based on distinct frequency bands",
        "importance": "high"
      },
      {
        "concept": "Guard bands to prevent overlapping channel crosstalk",
        "importance": "high"
      },
      {
        "concept": "Analog signal compatibility",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_014",
    "question": "What is Pulse Width Modulation (PWM)?",
    "topic": "Circuits",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Varying pulse duty cycle square wave parameters",
        "importance": "high"
      },
      {
        "concept": "Average power control in load devices",
        "importance": "high"
      },
      {
        "concept": "Motor speed control and LED dimming applications",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_015",
    "question": "What are Communication Protocols?",
    "topic": "Protocols",
    "category": "Embedded",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Synchronous vs Asynchronous standards",
        "importance": "high"
      },
      {
        "concept": "Baud rate, frame format, and parity parameters",
        "importance": "medium"
      },
      {
        "concept": "Bus topologies and master-slave assignments",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_016",
    "question": "Explain UART Communication.",
    "topic": "Protocols",
    "category": "Embedded",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Universal Asynchronous Receiver-Transmitter framework",
        "importance": "high"
      },
      {
        "concept": "Asynchronous frame timing (Start and Stop bits)",
        "importance": "high"
      },
      {
        "concept": "Point-to-point cross TX-RX wires configuration",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_017",
    "question": "Explain SPI Communication.",
    "topic": "Protocols",
    "category": "Embedded",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Serial Peripheral Interface synchronous master-slave clock",
        "importance": "high"
      },
      {
        "concept": "Full-duplex MOSI, MISO, SCLK communication lines",
        "importance": "high"
      },
      {
        "concept": "Chip select SS/CS lines addressing",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_018",
    "question": "Explain I2C Communication.",
    "topic": "Protocols",
    "category": "Embedded",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Inter-Integrated Circuit two-wire bus control",
        "importance": "high"
      },
      {
        "concept": "SDA (Data) and SCL (Clock) shared pull-up lines",
        "importance": "high"
      },
      {
        "concept": "7-bit or 10-bit device addressing system",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_019",
    "question": "What is Digital Logic?",
    "topic": "Digital Systems",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Binary representation Boolean algebra operations",
        "importance": "high"
      },
      {
        "concept": "Combinational logic arrays (multiplexers, adders)",
        "importance": "medium"
      },
      {
        "concept": "Sequential circuits clock states",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_020",
    "question": "What are Logic Gates?",
    "topic": "Digital Systems",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "AND, OR, NOT, XOR operations",
        "importance": "high"
      },
      {
        "concept": "Universal gates (NAND, NOR) completeness",
        "importance": "high"
      },
      {
        "concept": "Gate propagation delays",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_021",
    "question": "Explain Flip-Flops.",
    "topic": "Digital Systems",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "1-bit edge-triggered digital memory element",
        "importance": "high"
      },
      {
        "concept": "SR, JK, D, and T flip-flop behavior differences",
        "importance": "high"
      },
      {
        "concept": "Race-around condition in JK flip-flop",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_022",
    "question": "What is a Register?",
    "topic": "Digital Systems",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Group of flip-flops holding multi-bit binary data",
        "importance": "high"
      },
      {
        "concept": "Shift register loading operations (SISO, SIPO, PIPO)",
        "importance": "high"
      },
      {
        "concept": "Temporary storage in CPU execution path",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_023",
    "question": "What is a Counter Circuit?",
    "topic": "Digital Systems",
    "category": "Core Electronics",
    "type": "Core",
    "difficulty": "easy",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sequential circuit counting pulses sequence",
        "importance": "high"
      },
      {
        "concept": "Ripple/Asynchronous vs Synchronous counter designs",
        "importance": "high"
      },
      {
        "concept": "Modulo division states selection",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_024",
    "question": "Explain Error Detection Techniques.",
    "topic": "Signals",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Parity bit checks",
        "importance": "high"
      },
      {
        "concept": "Checksum generation logic",
        "importance": "medium"
      },
      {
        "concept": "Cyclic Redundancy Check (CRC) polynomial division",
        "importance": "high"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_025",
    "question": "Explain Error Correction Techniques.",
    "topic": "Signals",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Hamming code redundancy distance checks",
        "importance": "high"
      },
      {
        "concept": "Forward Error Correction (FEC) block code mechanisms",
        "importance": "high"
      },
      {
        "concept": "Redundancy bandwidth overhead trade-offs",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_026",
    "question": "What is OFDM?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Sharing channel based on distinct frequency bands",
        "importance": "high"
      },
      {
        "concept": "Guard bands to prevent overlapping channel crosstalk",
        "importance": "high"
      },
      {
        "concept": "Analog signal compatibility",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_027",
    "question": "Explain Cellular Communication.",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Geographic cell structures and BTS base stations",
        "importance": "high"
      },
      {
        "concept": "Frequency reuse factor grids allocation",
        "importance": "high"
      },
      {
        "concept": "Handoff mechanism (hard vs soft handovers)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_028",
    "question": "What is LTE?",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Long Term Evolution 4G standard specifications",
        "importance": "high"
      },
      {
        "concept": "OFDMA downlink and SC-FDMA uplink allocations",
        "importance": "high"
      },
      {
        "concept": "IP flat-network architecture (EPC)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_029",
    "question": "Explain the basic principles of 5G communication.",
    "topic": "Communication",
    "category": "Communication",
    "type": "Core",
    "difficulty": "hard",
    "discriminationWeight": 1.5,
    "keyConcepts": [
      {
        "concept": "Millimeter wave (mmWave) spectrum transmission limits",
        "importance": "high"
      },
      {
        "concept": "Massive MIMO and beamforming directional antenna targeting",
        "importance": "high"
      },
      {
        "concept": "Network slicing and low latency profiles (URLLC, eMBB)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_core_030",
    "question": "What is Embedded Systems Engineering?",
    "topic": "Digital Systems",
    "category": "Embedded",
    "type": "Core",
    "difficulty": "medium",
    "discriminationWeight": 1,
    "keyConcepts": [
      {
        "concept": "Hardware-software co-design limits optimization",
        "importance": "high"
      },
      {
        "concept": "Real-time task constraints (RTOS vs bare metal)",
        "importance": "high"
      },
      {
        "concept": "Resource constraints (RAM/ROM) coding efficiency",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_001",
    "question": "A circuit is not producing the expected output. How would you troubleshoot it?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_002",
    "question": "A communication channel has excessive noise. How would you identify the source?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_003",
    "question": "How would you improve signal quality in a communication system?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_004",
    "question": "A PCB prototype is overheating. What steps would you take?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_005",
    "question": "How would you diagnose a malfunctioning power supply?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_006",
    "question": "A wireless signal is weak inside a building. How would you improve coverage?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_007",
    "question": "How would you design a basic temperature monitoring system?",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_008",
    "question": "How would you design a smart home automation prototype?",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_009",
    "question": "A sensor is giving unstable readings. How would you investigate?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_010",
    "question": "How would you reduce power consumption in an embedded device?",
    "topic": "Power Management",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Microcontroller sleep modes and clock speed reduction",
        "importance": "high"
      },
      {
        "concept": "Sensing peripherals power-gating switch controls",
        "importance": "high"
      },
      {
        "concept": "Efficient voltage regulators and low quiescent current LDOs",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_011",
    "question": "Design a simple communication link between two microcontrollers.",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_012",
    "question": "A transmitter and receiver are failing to communicate. How would you debug the issue?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_013",
    "question": "How would you improve antenna performance?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_014",
    "question": "A digital circuit produces intermittent errors. How would you troubleshoot it?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_015",
    "question": "How would you design a traffic light control system?",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_016",
    "question": "How would you reduce electromagnetic interference in a device?",
    "topic": "Practical Application",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Hardware specification requirements matching",
        "importance": "high"
      },
      {
        "concept": "System schematic block flow mapping",
        "importance": "high"
      },
      {
        "concept": "Prototyping testing and validation steps",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_017",
    "question": "How would you test the reliability of an electronic system?",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_018",
    "question": "A network experiences packet loss. How would you investigate?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_019",
    "question": "Design a basic security alarm system.",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_020",
    "question": "How would you monitor the health of industrial equipment using sensors?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_021",
    "question": "How would you build a remote-controlled device?",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_022",
    "question": "A communication system experiences frequent data corruption. What would you do?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_023",
    "question": "Design a simple IoT-based monitoring solution.",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_024",
    "question": "How would you improve battery life in a portable device?",
    "topic": "Power Management",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Microcontroller sleep modes and clock speed reduction",
        "importance": "high"
      },
      {
        "concept": "Sensing peripherals power-gating switch controls",
        "importance": "high"
      },
      {
        "concept": "Efficient voltage regulators and low quiescent current LDOs",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_025",
    "question": "How would you diagnose communication latency issues?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_026",
    "question": "Design a digital voting machine.",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_027",
    "question": "How would you improve reliability in a wireless network?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "medium",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_028",
    "question": "Design a basic vehicle tracking system.",
    "topic": "Embedded Systems Design",
    "category": "Embedded",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Sensor integration and ADC signal conditioning",
        "importance": "high"
      },
      {
        "concept": "Microcontroller peripherals selection (GPIO, Timers, UART)",
        "importance": "high"
      },
      {
        "concept": "Wireless interface connection protocols (MQTT, Wi-Fi, BLE)",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_029",
    "question": "How would you ensure signal integrity in a high-speed communication system?",
    "topic": "RF and Communication",
    "category": "Communication",
    "type": "Scenario",
    "difficulty": "hard",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Spectrum analyzer checks for EMI sources",
        "importance": "high"
      },
      {
        "concept": "Impedance matching tuning and shielding optimization",
        "importance": "high"
      },
      {
        "concept": "Filtering, amplification, or error correction implementations",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "etc_scen_030",
    "question": "How would you design a scalable IoT sensor network?",
    "topic": "Hardware Troubleshooting",
    "category": "Core Electronics",
    "type": "Scenario",
    "difficulty": "easy",
    "discriminationWeight": 1.2,
    "keyConcepts": [
      {
        "concept": "Multimeter node voltage and continuity testing",
        "importance": "high"
      },
      {
        "concept": "Thermal camera hotspot inspection and trace modifications",
        "importance": "high"
      },
      {
        "concept": "Oscilloscope ripple checking and decoupling filter addition",
        "importance": "medium"
      }
    ],
    "role": "ETC",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  AI: [
  {
    "id": "ai_fund_001",
    "question": "What is Machine Learning and how does it differ from traditional programming?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Data-driven learning",
      "Rule-based vs learning-based models"
    ],
    "keyConcepts": [
      {
        "concept": "Rule-based vs data-driven logic",
        "importance": "high"
      },
      {
        "concept": "Model training process",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_fund_002",
    "question": "What is a Neural Network and what are its main components?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Neurons/Nodes",
      "Weights and Biases",
      "Layers (Input, Hidden, Output)"
    ],
    "keyConcepts": [
      {
        "concept": "Layered network structure",
        "importance": "high"
      },
      {
        "concept": "Activation functions",
        "importance": "medium"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_fund_003",
    "question": "Explain the difference between Supervised, Unsupervised, and Reinforcement Learning.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Labeled vs unlabeled data",
      "Reward-based learning",
      "Use cases"
    ],
    "keyConcepts": [
      {
        "concept": "Labeled vs unlabeled data",
        "importance": "high"
      },
      {
        "concept": "Reinforcement feedback loop",
        "importance": "medium"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_fund_004",
    "question": "What is Overfitting in Machine Learning and how can you detect it?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "High training accuracy vs low test accuracy",
      "Generalization error",
      "Validation curves"
    ],
    "keyConcepts": [
      {
        "concept": "High variance / low bias",
        "importance": "high"
      },
      {
        "concept": "Validation performance drop",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_fund_005",
    "question": "What is an Activation Function in neural networks and why is it needed?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Introducing non-linearity",
      "Sigmoid, ReLU, Tanh",
      "Preventing linear collapse"
    ],
    "keyConcepts": [
      {
        "concept": "Introducing non-linearity",
        "importance": "high"
      },
      {
        "concept": "ReLU/Sigmoid definition",
        "importance": "medium"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_fund_006",
    "question": "What is Gradient Descent and how does it optimize a model?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Loss function minimization",
      "Learning rate parameter",
      "Iterative weight updates"
    ],
    "keyConcepts": [
      {
        "concept": "Loss function minimization",
        "importance": "high"
      },
      {
        "concept": "Learning rate step size",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_001",
    "question": "Explain the Backpropagation algorithm in neural networks.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Chain rule of calculus",
      "Error gradients propagation",
      "Weight and bias updates"
    ],
    "keyConcepts": [
      {
        "concept": "Chain rule of calculus",
        "importance": "high"
      },
      {
        "concept": "Error derivative computation",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_002",
    "question": "What is the difference between CNNs and RNNs, and when would you use each?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Spatial patterns (CNN) vs temporal/sequential patterns (RNN)",
      "Weight sharing",
      "Recurrence relation"
    ],
    "keyConcepts": [
      {
        "concept": "Spatial translation invariance",
        "importance": "high"
      },
      {
        "concept": "Sequential memory state",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_003",
    "question": "Explain the core mechanics of the Transformer architecture.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Self-attention mechanism",
      "Positional encoding",
      "Parallel processing advantage"
    ],
    "keyConcepts": [
      {
        "concept": "Self-attention mechanism",
        "importance": "high"
      },
      {
        "concept": "Positional embeddings",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_004",
    "question": "How do Precision, Recall, and F1-score evaluate a model's performance?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "True Positives / False Positives balance",
      "Imbalanced datasets metric selection",
      "Harmonic mean of precision and recall"
    ],
    "keyConcepts": [
      {
        "concept": "Precision vs Recall definitions",
        "importance": "high"
      },
      {
        "concept": "F1-score harmonic mean",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_005",
    "question": "Explain how a Random Forest classifier works.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Ensemble of Decision Trees",
      "Bagging/Bootstrap aggregating",
      "Feature randomness"
    ],
    "keyConcepts": [
      {
        "concept": "Decision tree aggregation",
        "importance": "high"
      },
      {
        "concept": "Bagging bootstrap sampling",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_core_006",
    "question": "What is regularization in machine learning and how do L1 and L2 methods differ?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Preventing overfitting",
      "L1 Lasso (sparsity/L1 norm)",
      "L2 Ridge (weight decay/L2 norm)"
    ],
    "keyConcepts": [
      {
        "concept": "L1 norm sparse feature selection",
        "importance": "high"
      },
      {
        "concept": "L2 norm weight shrink",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_001",
    "question": "How would you design a real-time product recommendation engine for an e-commerce platform?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Collaborative filtering vs Content-based",
      "Hybrid system integration",
      "Latency constraints & caching"
    ],
    "keyConcepts": [
      {
        "concept": "Collaborative filtering logic",
        "importance": "high"
      },
      {
        "concept": "Hybrid recommender design",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_002",
    "question": "How would you handle a highly imbalanced dataset (e.g., 99.9% negative, 0.1% positive) for fraud detection?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "SMOTE oversampling vs Undersampling",
      "Class weights adjustment",
      "Precision-Recall Curve / AUC evaluation"
    ],
    "keyConcepts": [
      {
        "concept": "Oversampling/SMOTE techniques",
        "importance": "high"
      },
      {
        "concept": "Recall/F1 optimization over accuracy",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_003",
    "question": "Design a deployment pipeline to run a large language model (LLM) on a memory-constrained edge device.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Quantization (FP16 to INT8/INT4)",
      "Pruning and Distillation",
      "Model compilation"
    ],
    "keyConcepts": [
      {
        "concept": "Quantization INT8 conversion",
        "importance": "high"
      },
      {
        "concept": "Knowledge distillation/pruning",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_004",
    "question": "How would you optimize a deep neural network that is training extremely slowly?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "medium",
    "evaluationGuide": [
      "Vanishing gradients / Batch Normalization",
      "Learning rate scheduling",
      "GPU batch size scaling & mixed precision"
    ],
    "keyConcepts": [
      {
        "concept": "Batch Normalization implementation",
        "importance": "high"
      },
      {
        "concept": "Mixed precision training",
        "importance": "medium"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_005",
    "question": "How would you detect and mitigate demographic bias in a facial recognition model?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Dataset representation auditing",
      "Fairness metrics calculation",
      "Adversarial debiasing during training"
    ],
    "keyConcepts": [
      {
        "concept": "Dataset demographic auditing",
        "importance": "high"
      },
      {
        "concept": "Pre-processing/in-processing mitigations",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ai_scen_006",
    "question": "Design a real-time anomaly detection system for a network of 10,000 IoT temperature sensors.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Streaming architecture (Kafka/Flink)",
      "Isolation Forest or Autoencoder models",
      "Edge filtering"
    ],
    "keyConcepts": [
      {
        "concept": "Streaming data windowing",
        "importance": "high"
      },
      {
        "concept": "Autoencoder anomaly thresholding",
        "importance": "high"
      }
    ],
    "role": "AI",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  DS: [
  {
    "id": "ds_fund_001",
    "question": "State the Central Limit Theorem and explain its importance in statistical inference.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Normal distribution convergence",
      "Sample means distribution",
      "Large sample sizes (N > 30)"
    ],
    "keyConcepts": [
      {
        "concept": "Normal distribution convergence",
        "importance": "high"
      },
      {
        "concept": "Sample means distribution behavior",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_fund_002",
    "question": "What is a p-value and how do you interpret it in a hypothesis test?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Probability under null hypothesis",
      "Significance level (alpha)",
      "Rejecting null hypothesis"
    ],
    "keyConcepts": [
      {
        "concept": "Probability under null hypothesis",
        "importance": "high"
      },
      {
        "concept": "Alpha threshold comparison",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_fund_003",
    "question": "Explain the Bias-Variance tradeoff in supervised learning models.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Underfitting (high bias)",
      "Overfitting (high variance)",
      "Total error minimization"
    ],
    "keyConcepts": [
      {
        "concept": "Underfitting vs Overfitting balance",
        "importance": "high"
      },
      {
        "concept": "Error minimization target",
        "importance": "medium"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_fund_004",
    "question": "How does Linear Regression work and what are its key assumptions?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Ordinary Least Squares (OLS)",
      "Linearity, Homoscedasticity, Independence, Normality",
      "Residual analysis"
    ],
    "keyConcepts": [
      {
        "concept": "Ordinary Least Squares fit",
        "importance": "high"
      },
      {
        "concept": "Homoscedasticity assumption",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_fund_005",
    "question": "What is the difference between covariance and correlation?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Direction of relationship (covariance)",
      "Strength and direction normalized (correlation)",
      "Scale independence"
    ],
    "keyConcepts": [
      {
        "concept": "Normalized scale of correlation",
        "importance": "high"
      },
      {
        "concept": "Covariance scale dependence",
        "importance": "medium"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_fund_006",
    "question": "What is a box plot and what statistical values does it visualize?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Quartiles (Q1, Median, Q3)",
      "Interquartile Range (IQR)",
      "Outliers detection threshold (1.5*IQR)"
    ],
    "keyConcepts": [
      {
        "concept": "Median and Quartiles visualization",
        "importance": "high"
      },
      {
        "concept": "Interquartile Range IQR definition",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_001",
    "question": "Explain Logistic Regression and how the log-odds relationship works.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Sigmoid function mapping to probability",
      "Log-odds link function",
      "Maximum Likelihood Estimation"
    ],
    "keyConcepts": [
      {
        "concept": "Sigmoid function mapping",
        "importance": "high"
      },
      {
        "concept": "Log-odds linear relationship",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_002",
    "question": "Explain the working steps of the K-Means clustering algorithm.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Centroid initialization",
      "Distance metric assignment (Euclidean)",
      "Iterative centroid updates & convergence"
    ],
    "keyConcepts": [
      {
        "concept": "Iterative centroid update loop",
        "importance": "high"
      },
      {
        "concept": "Euclidean distance assignment",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_003",
    "question": "How does Principal Component Analysis (PCA) perform dimensionality reduction?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Eigenvectors and Eigenvalues",
      "Covariance matrix factorization",
      "Variance maximization projection"
    ],
    "keyConcepts": [
      {
        "concept": "Eigenvalue decomposition",
        "importance": "high"
      },
      {
        "concept": "Variance maximization target",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_004",
    "question": "Explain A/B testing and how you calculate the minimum sample size required.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Statistical power (1-beta) and significance (alpha)",
      "Minimum Detectable Effect (MDE)",
      "Power analysis calculation"
    ],
    "keyConcepts": [
      {
        "concept": "Statistical power and alpha limits",
        "importance": "high"
      },
      {
        "concept": "Minimum Detectable Effect MDE",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_005",
    "question": "What is cross-validation and why is it preferred over a simple train/test split?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "K-Fold partition logic",
      "Reducing validation variance",
      "Hyperparameter tuning safety"
    ],
    "keyConcepts": [
      {
        "concept": "K-Fold dataset partition",
        "importance": "high"
      },
      {
        "concept": "Reducing validation variance",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_core_006",
    "question": "Explain the difference between L1 (Lasso) and L2 (Ridge) regularization.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Absolute value penalty (L1) vs Squared value penalty (L2)",
      "Feature selection/sparsity (L1)",
      "Weight shrinkage without zeroing (L2)"
    ],
    "keyConcepts": [
      {
        "concept": "L1 norm absolute penalty",
        "importance": "high"
      },
      {
        "concept": "L2 norm squared penalty",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_001",
    "question": "How would you handle a tabular dataset containing 30% missing values in critical columns?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "medium",
    "evaluationGuide": [
      "Missing Completely at Random (MCAR) vs MAR",
      "Mean/Median vs KNN/MICE imputation",
      "Flagging missingness with indicator columns"
    ],
    "keyConcepts": [
      {
        "concept": "MCAR vs MAR classification",
        "importance": "high"
      },
      {
        "concept": "MICE/KNN imputation methods",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_002",
    "question": "How would you design a validation pipeline to detect and handle data drift for a live prediction model?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Statistical tests (KS test, PSI)",
      "Scheduled schema validation",
      "Retraining pipeline triggers"
    ],
    "keyConcepts": [
      {
        "concept": "Population Stability Index PSI",
        "importance": "high"
      },
      {
        "concept": "Kolmogorov-Smirnov KS testing",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_003",
    "question": "Design an experiment to test if a new dynamic pricing algorithm increases total revenue for a ride-sharing app.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Network effects violation (Spillover)",
      "Geo-cluster randomization or Switchback testing",
      "Metrics tracking"
    ],
    "keyConcepts": [
      {
        "concept": "Switchback testing design",
        "importance": "high"
      },
      {
        "concept": "Geo-cluster randomization",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_004",
    "question": "How would you identify outliers in a highly dimensional customer transaction database?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Isolation Forest",
      "DBSCAN clustering",
      "Mahalanobis distance for multivariate scaling"
    ],
    "keyConcepts": [
      {
        "concept": "Isolation Forest outlier scoring",
        "importance": "high"
      },
      {
        "concept": "DBSCAN core vs noise points",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_005",
    "question": "Design a feature engineering pipeline to predict subscriber churn for a streaming platform.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "medium",
    "evaluationGuide": [
      "Temporal aggregation (rolling usage windows)",
      "Encoding categorical user plans",
      "Interaction features (cost per stream)"
    ],
    "keyConcepts": [
      {
        "concept": "Rolling temporal window aggregation",
        "importance": "high"
      },
      {
        "concept": "Categorical variable encoding",
        "importance": "medium"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ds_scen_006",
    "question": "How would you explain to business executives why a highly accurate model suddenly failed in production?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "medium",
    "evaluationGuide": [
      "Covariate shift description",
      "Simplifying statistical terminology",
      "Proposing root cause resolution steps"
    ],
    "keyConcepts": [
      {
        "concept": "Covariate/concept shift explanation",
        "importance": "high"
      },
      {
        "concept": "Actionable remediation steps",
        "importance": "high"
      }
    ],
    "role": "DS",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  CYBER: [
  {
    "id": "cyber_fund_001",
    "question": "What is the CIA Triad in Cyber Security?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Confidentiality (encryption/access)",
      "Integrity (hashing/signatures)",
      "Availability (redundancy/uptime)"
    ],
    "keyConcepts": [
      {
        "concept": "Confidentiality definition",
        "importance": "high"
      },
      {
        "concept": "Integrity hashing checks",
        "importance": "high"
      },
      {
        "concept": "Availability uptime guarantees",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_fund_002",
    "question": "Explain the difference between Symmetric and Asymmetric Cryptography.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Single shared key vs public/private key pairs",
      "Speed and computational complexity",
      "Key distribution challenges"
    ],
    "keyConcepts": [
      {
        "concept": "Shared secret key",
        "importance": "high"
      },
      {
        "concept": "Public/Private key pairs",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_fund_003",
    "question": "What is a Firewall and how does it protect a network?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Traffic filtering rules",
      "Packet inspection (stateless/stateful)",
      "Port blocking"
    ],
    "keyConcepts": [
      {
        "concept": "Traffic filtering rules",
        "importance": "high"
      },
      {
        "concept": "Stateful packet inspection",
        "importance": "medium"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_fund_004",
    "question": "What is Phishing and how do modern security layers defend against it?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Social engineering attack vector",
      "Email spoofing and SPF/DKIM/DMARC",
      "Multi-factor authentication (MFA) safety"
    ],
    "keyConcepts": [
      {
        "concept": "Social engineering vector",
        "importance": "high"
      },
      {
        "concept": "SPF/DKIM/DMARC authentication",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_fund_005",
    "question": "What is a VPN and how does it secure remote data transmissions?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "IP tunneling",
      "End-to-end data encryption",
      "IP masking"
    ],
    "keyConcepts": [
      {
        "concept": "IP tunneling mechanism",
        "importance": "high"
      },
      {
        "concept": "End-to-end data encryption",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_fund_006",
    "question": "What is SQL Injection (SQLi) and how can it be prevented?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Malicious SQL payload injection",
      "Parameterized queries / prepared statements",
      "Input sanitization"
    ],
    "keyConcepts": [
      {
        "concept": "Parameterized queries",
        "importance": "high"
      },
      {
        "concept": "Database input sanitization",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_001",
    "question": "Explain the mechanics of the Diffie-Hellman Key Exchange protocol.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Shared secret generation over public channel",
      "Mathematical modulus operations",
      "Asymmetric verification"
    ],
    "keyConcepts": [
      {
        "concept": "Modulus exponentiation mechanics",
        "importance": "high"
      },
      {
        "concept": "Shared secret derivation",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_002",
    "question": "How does a Man-in-the-Middle (MitM) attack work and how does SSL/TLS mitigate it?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Interception of communication traffic",
      "Certificate Authorities validation",
      "Cryptographic session keys"
    ],
    "keyConcepts": [
      {
        "concept": "Traffic interception vector",
        "importance": "high"
      },
      {
        "concept": "Certificate Authority verification",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_003",
    "question": "Explain DNS Spoofing and Cache Poisoning.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Falsifying DNS resolver records",
      "DNS query/transaction ID guessing",
      "Mitigation via DNSSEC"
    ],
    "keyConcepts": [
      {
        "concept": "Resolver cache corruption",
        "importance": "high"
      },
      {
        "concept": "DNSSEC cryptographic signatures",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_004",
    "question": "Compare vulnerability scanning with penetration testing.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Automated broad scanning vs manual deep exploitation",
      "Frequency of execution",
      "Compliance vs actual security posture"
    ],
    "keyConcepts": [
      {
        "concept": "Automated scan reports",
        "importance": "high"
      },
      {
        "concept": "Exploitation testing",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_005",
    "question": "Explain the OAuth 2.0 authorization code flow.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Redirect redirects with auth codes",
      "Token exchange mechanism",
      "Client secret verification"
    ],
    "keyConcepts": [
      {
        "concept": "Auth code redirect exchange",
        "importance": "high"
      },
      {
        "concept": "Access/Refresh token isolation",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_core_006",
    "question": "What is Zero Trust architecture and what are its core guidelines?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Never trust, always verify",
      "Least privilege access rules",
      "Microsegmentation of networks"
    ],
    "keyConcepts": [
      {
        "concept": "Continuous verification model",
        "importance": "high"
      },
      {
        "concept": "Least privilege access rules",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_001",
    "question": "How would you respond to a suspected active ransomware attack on a company database server?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Isolating affected systems immediately (network disconnect)",
      "Incident logging and containment",
      "Backup validation and disaster recovery"
    ],
    "keyConcepts": [
      {
        "concept": "System network isolation",
        "importance": "high"
      },
      {
        "concept": "Cold backup restore validation",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_002",
    "question": "Design a secure login and multi-factor authentication (MFA) flow for a high-risk banking web app.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Password hashing (bcrypt/Argon2)",
      "Time-based One Time Password (TOTP) or WebAuthn",
      "Brute-force protection & session security"
    ],
    "keyConcepts": [
      {
        "concept": "WebAuthn/FIDO2 standard",
        "importance": "high"
      },
      {
        "concept": "Argon2 password hashing",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_003",
    "question": "How would you secure a company's public web server against a large-scale DDoS attack?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Anycast routing network",
      "Rate limiting and web application firewalls (WAF)",
      "Cloud DDoS scrubbing center integration"
    ],
    "keyConcepts": [
      {
        "concept": "DDoS scrubbing service integration",
        "importance": "high"
      },
      {
        "concept": "WAF rate limiting configurations",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_004",
    "question": "How would you conduct a security audit on a legacy software application without current source code?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Dynamic Application Security Testing (DAST)",
      "Black-box penetration testing",
      "Network port listening scanning"
    ],
    "keyConcepts": [
      {
        "concept": "DAST runtime auditing",
        "importance": "high"
      },
      {
        "concept": "Black-box penetration testing",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_005",
    "question": "Design an incident response plan to handle a major data breach exposing customer passwords.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Breach containment and system lock down",
      "Legal/compliance notification timelines",
      "Enforcing system-wide password rotations"
    ],
    "keyConcepts": [
      {
        "concept": "Breach containment pipeline",
        "importance": "high"
      },
      {
        "concept": "Notification SLA compliance",
        "importance": "medium"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "cyber_scen_006",
    "question": "How would you design secure remote access controls for employees connecting to internal cloud resources?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Identity-Aware Proxy (IAP)",
      "Context-aware access control lists",
      "Continuous device compliance health checks"
    ],
    "keyConcepts": [
      {
        "concept": "Identity-Aware Proxy implementation",
        "importance": "high"
      },
      {
        "concept": "Context-aware access controls",
        "importance": "high"
      }
    ],
    "role": "CYBER",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  EE: [
  {
    "id": "ee_fund_001",
    "question": "Explain Kirchhoff's Voltage Law (KVL) and its relation to energy conservation.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Sum of loop voltages equals zero",
      "Conservation of electric potential energy",
      "Loop analysis equations"
    ],
    "keyConcepts": [
      {
        "concept": "Loop voltage sum equals zero",
        "importance": "high"
      },
      {
        "concept": "Energy conservation principle",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_fund_002",
    "question": "Explain Faraday's Law of Electromagnetic Induction.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Induced EMF proportional to flux rate of change",
      "Lenz's Law directional opposition",
      "Magnetic field lines cutting conductors"
    ],
    "keyConcepts": [
      {
        "concept": "Flux change induction",
        "importance": "high"
      },
      {
        "concept": "Lenz's law direction opposition",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_fund_003",
    "question": "What is the difference between AC and DC current?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Alternating sinusoidal direction vs constant direct path",
      "Frequency differences (50/60Hz vs 0Hz)",
      "Transformer compatibility"
    ],
    "keyConcepts": [
      {
        "concept": "Sinusoidal direction changes",
        "importance": "high"
      },
      {
        "concept": "Constant direct flow",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_fund_004",
    "question": "What is an electrical transformer and how does it work?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Mutual electromagnetic induction",
      "Primary/Secondary turns ratio",
      "Step-up vs Step-down operations"
    ],
    "keyConcepts": [
      {
        "concept": "Mutual induction principle",
        "importance": "high"
      },
      {
        "concept": "Turns ratio equation",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_fund_005",
    "question": "What is the Power Factor in AC electrical systems?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "medium",
    "evaluationGuide": [
      "Cosine of phase angle between voltage and current",
      "Ratio of Active Power to Apparent Power",
      "Efficiency metrics"
    ],
    "keyConcepts": [
      {
        "concept": "Active to Apparent power ratio",
        "importance": "high"
      },
      {
        "concept": "Voltage-current phase angle cosine",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_fund_006",
    "question": "What is a capacitor and how does it behave in DC vs AC circuits?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Electric field charge storage",
      "Blocks DC (infinite impedance)",
      "Passes AC (capacitive reactance)"
    ],
    "keyConcepts": [
      {
        "concept": "DC blocking behavior",
        "importance": "high"
      },
      {
        "concept": "Capacitive reactance impedance",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_001",
    "question": "Explain the working principle of a 3-phase induction motor.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Rotating Magnetic Field (RMF)",
      "Induced rotor current and torque generation",
      "Slip speed differences"
    ],
    "keyConcepts": [
      {
        "concept": "Rotating Magnetic Field creation",
        "importance": "high"
      },
      {
        "concept": "Rotor current induction",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_002",
    "question": "What is grid synchronization in power systems and why is it critical?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Matching Voltage magnitude, Frequency, Phase sequence, and Phase angle",
      "Avoiding heavy fault currents",
      "Grid safety regulations"
    ],
    "keyConcepts": [
      {
        "concept": "Grid parameter matching criteria",
        "importance": "high"
      },
      {
        "concept": "Transient fault prevention",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_003",
    "question": "Explain transmission line impedance matching and the reflection coefficient.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Source and Load impedance equalization",
      "Preventing signal reflections",
      "Standing Wave Ratio (SWR) implications"
    ],
    "keyConcepts": [
      {
        "concept": "Impedance equalization target",
        "importance": "high"
      },
      {
        "concept": "Reflection coefficient minimization",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_004",
    "question": "How does a buck-boost converter regulate output voltage?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "PWM duty cycle adjustment",
      "Energy storage in inductor",
      "Step-up vs Step-down voltage conversion"
    ],
    "keyConcepts": [
      {
        "concept": "PWM duty cycle regulation",
        "importance": "high"
      },
      {
        "concept": "Inductor energy charge transfer",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_005",
    "question": "Explain active, reactive, and apparent power in AC systems.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Active power (Watts - real work)",
      "Reactive power (VAR - field maintenance)",
      "Apparent power (VA - total vector sum)"
    ],
    "keyConcepts": [
      {
        "concept": "Active real work power",
        "importance": "high"
      },
      {
        "concept": "Reactive field power",
        "importance": "high"
      },
      {
        "concept": "Apparent power vector sum",
        "importance": "medium"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_core_006",
    "question": "Explain synchronous machine transient stability.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Rotor angle changes after disturbance",
      "Equal Area Criterion",
      "Critical clearing time of fault"
    ],
    "keyConcepts": [
      {
        "concept": "Rotor angle stability boundaries",
        "importance": "high"
      },
      {
        "concept": "Equal Area Criterion math",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_001",
    "question": "How would you design a power supply protection system for a sensitive medical device?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Isolation transformers",
      "Overvoltage/Undervoltage protection loops (MOV, TVS)",
      "UPS battery backup switches"
    ],
    "keyConcepts": [
      {
        "concept": "Isolation transformer utilization",
        "importance": "high"
      },
      {
        "concept": "TVS diode surge protection",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_002",
    "question": "How would you diagnose a sudden voltage sag in an industrial factory?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Analyzing power quality analyzer logs",
      "Checking for large motor start current sags",
      "Substation load checks"
    ],
    "keyConcepts": [
      {
        "concept": "Power quality analyzer log audit",
        "importance": "high"
      },
      {
        "concept": "Induction motor startup current sag",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_003",
    "question": "Design a solar inverter grid-tie control loop.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Phase Locked Loop (PLL) grid matching",
      "Maximum Power Point Tracking (MPPT)",
      "Grid disconnect safety logic"
    ],
    "keyConcepts": [
      {
        "concept": "PLL phase matching control loop",
        "importance": "high"
      },
      {
        "concept": "MPPT optimization algorithm",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_004",
    "question": "How would you reduce electromagnetic interference (EMI) in a high-frequency switching circuit?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Decoupling capacitors placement",
      "Ground plane design",
      "Shielding and snubber circuits"
    ],
    "keyConcepts": [
      {
        "concept": "Ground plane separation",
        "importance": "high"
      },
      {
        "concept": "Snubber circuit damping",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_005",
    "question": "Design a battery management system (BMS) for an electric vehicle battery pack.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Cell voltage balancing (active/passive)",
      "State of Charge (SoC) estimation algorithms",
      "Overcurrent/Thermal disconnect loops"
    ],
    "keyConcepts": [
      {
        "concept": "Cell voltage balancing design",
        "importance": "high"
      },
      {
        "concept": "SoC estimation filter",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ee_scen_006",
    "question": "How would you improve the power factor of a factory with heavy inductive loads?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Automatic Capacitor Banks installation",
      "Synchronous condensers",
      "Tuning harmonic filters"
    ],
    "keyConcepts": [
      {
        "concept": "Capacitor bank reactive correction",
        "importance": "high"
      },
      {
        "concept": "Harmonic detuning filter designs",
        "importance": "high"
      }
    ],
    "role": "EE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  ME: [
  {
    "id": "me_fund_001",
    "question": "Explain Newton's Law of Cooling and its parameters.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Heat transfer rate proportional to temp difference",
      "Heat transfer coefficient (h)",
      "Surface area factor"
    ],
    "keyConcepts": [
      {
        "concept": "Temperature difference proportionality",
        "importance": "high"
      },
      {
        "concept": "Convective heat transfer coefficient",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_fund_002",
    "question": "What is stress and strain, and what is their relationship in Hooke's Law?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Force per unit area (stress)",
      "Deformation ratio (strain)",
      "Young's Modulus linear ratio"
    ],
    "keyConcepts": [
      {
        "concept": "Force per unit area stress",
        "importance": "high"
      },
      {
        "concept": "Deformation ratio strain",
        "importance": "high"
      },
      {
        "concept": "Young's Modulus ratio constant",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_fund_003",
    "question": "Explain the First and Second Laws of Thermodynamics.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Energy conservation (First Law)",
      "Entropy increase / heat flows hot to cold (Second Law)",
      "Efficiency limits"
    ],
    "keyConcepts": [
      {
        "concept": "Conservation of energy",
        "importance": "high"
      },
      {
        "concept": "Entropy increase law",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_fund_004",
    "question": "What is a heat exchanger and what are the main types?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Thermal energy transfer between fluids",
      "Parallel-flow, Counter-flow, Cross-flow",
      "Log Mean Temperature Difference (LMTD)"
    ],
    "keyConcepts": [
      {
        "concept": "Counter-flow efficiency advantages",
        "importance": "high"
      },
      {
        "concept": "LMTD thermal calculations",
        "importance": "medium"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_fund_005",
    "question": "Explain Bernoulli's Principle in fluid mechanics.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Total energy in steady flow remains constant",
      "Inversely proportional relation: pressure vs velocity",
      "Elevation head considerations"
    ],
    "keyConcepts": [
      {
        "concept": "Pressure-velocity inverse relationship",
        "importance": "high"
      },
      {
        "concept": "Conservation of fluid energy",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_fund_006",
    "question": "What is the difference between elastic and plastic deformation?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Reversible shape recovery (elastic)",
      "Permanent atomic slip deformation (plastic)",
      "Yield point threshold boundary"
    ],
    "keyConcepts": [
      {
        "concept": "Yield point limit boundary",
        "importance": "high"
      },
      {
        "concept": "Reversible recovery elastic zone",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_001",
    "question": "Explain the differences between the Otto and Diesel thermodynamic cycles.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Constant volume heat addition (Otto) vs Constant pressure (Diesel)",
      "Spark vs Compression ignition",
      "Compression ratio variations"
    ],
    "keyConcepts": [
      {
        "concept": "Constant volume vs constant pressure heat addition",
        "importance": "high"
      },
      {
        "concept": "Compression ratios differences",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_002",
    "question": "Explain the purpose and process of Finite Element Analysis (FEA) in design validation.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Discretization into small elements (meshing)",
      "Solving stiffness matrix equations",
      "Identifying stress concentrations (Von Mises)"
    ],
    "keyConcepts": [
      {
        "concept": "Stiffness matrix calculation",
        "importance": "high"
      },
      {
        "concept": "Von Mises stress validation",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_003",
    "question": "Explain Euler's Buckling Theory for structural columns.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Critical buckling load formula",
      "Effective length factor (boundary conditions)",
      "Slenderness ratio limits"
    ],
    "keyConcepts": [
      {
        "concept": "Critical buckling load equations",
        "importance": "high"
      },
      {
        "concept": "Boundary condition effective lengths",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_004",
    "question": "What is hydrodynamic lubrication and how does it prevent mechanical wear?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Fluid film generation by relative speed",
      "Viscosity support load",
      "No direct metal-metal contact"
    ],
    "keyConcepts": [
      {
        "concept": "Relative speed fluid film creation",
        "importance": "high"
      },
      {
        "concept": "Oil film pressure load support",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_005",
    "question": "How does regenerative braking work in mechanical and hybrid drivetrains?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Kinetic energy conversion to electrical/potential energy",
      "Motor acting as generator",
      "Braking torque generation"
    ],
    "keyConcepts": [
      {
        "concept": "Generator kinetic conversion",
        "importance": "high"
      },
      {
        "concept": "Braking torque feedback loop",
        "importance": "medium"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_core_006",
    "question": "What is fatigue strength and how is it characterized in engineering?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Repeated cyclical loading failures",
      "S-N Curve (Stress vs Cycles)",
      "Endurance limit definition"
    ],
    "keyConcepts": [
      {
        "concept": "S-N Curve plotting characteristics",
        "importance": "high"
      },
      {
        "concept": "Endurance limit stress threshold",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_001",
    "question": "How would you select materials for a spacecraft hull exposed to extreme thermal cycling?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Low coefficient of thermal expansion (CTE)",
      "High strength-to-weight ratio (titanium/carbon composites)",
      "Micro-cracking resistance"
    ],
    "keyConcepts": [
      {
        "concept": "Thermal expansion CTE matching",
        "importance": "high"
      },
      {
        "concept": "Strength-to-weight ratio composites",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_002",
    "question": "Design a liquid cooling system for a high-performance computer CPU.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Copper cold plate with micro-channels",
      "Pump flow rate and radiator capacity calculation",
      "Fluid selection (dielectric/anti-corrosive)"
    ],
    "keyConcepts": [
      {
        "concept": "Micro-channel cold plate design",
        "importance": "high"
      },
      {
        "concept": "Radiator heat dissipation calculations",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_003",
    "question": "How would you troubleshoot excessive vibration in an industrial steam turbine?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Vibration spectrum analysis (fast Fourier transform)",
      "Rotor imbalance vs bearing misalignment diagnosis",
      "Resonant critical speed checking"
    ],
    "keyConcepts": [
      {
        "concept": "Spectrum FFT analysis diagnostics",
        "importance": "high"
      },
      {
        "concept": "Rotor imbalance/alignment checks",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_004",
    "question": "Design a mechanical gearbox with a 5:1 reduction ratio under heavy load conditions.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Spur vs helical gears selection",
      "Gear tooth bending stress calculation (Lewis formula)",
      "Lubrication and bearing selection"
    ],
    "keyConcepts": [
      {
        "concept": "Helical gear selection for load",
        "importance": "high"
      },
      {
        "concept": "Lewis bending stress verification",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_005",
    "question": "How would you optimize the aerodynamic drag of an electric delivery van?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Computational Fluid Dynamics (CFD)",
      "Reducing frontal area & smoothing underbody flow",
      "Vortex generator placement"
    ],
    "keyConcepts": [
      {
        "concept": "CFD drag coefficient optimization",
        "importance": "high"
      },
      {
        "concept": "Boundary layer attachment designs",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "me_scen_006",
    "question": "How would you inspect and prevent fatigue failure in a crane suspension link?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Non-Destructive Testing (NDT) - dye penetrant or ultrasonic",
      "Calculating fatigue life under cyclic loads",
      "Stress concentration reduction (fillet radius enhancement)"
    ],
    "keyConcepts": [
      {
        "concept": "NDT ultrasonic detection",
        "importance": "high"
      },
      {
        "concept": "Fillet radius stress relief design",
        "importance": "high"
      }
    ],
    "role": "ME",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  CE: [
  {
    "id": "ce_fund_001",
    "question": "Explain Bernoulli's Theorem in hydraulics and its assumptions.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Total energy in steady flow is constant",
      "Assumptions: inviscid, incompressible, steady, irrotational",
      "Pressure, kinetic, and potential head relation"
    ],
    "keyConcepts": [
      {
        "concept": "Conservation of fluid energy heads",
        "importance": "high"
      },
      {
        "concept": "Inviscid incompressible flow assumptions",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_fund_002",
    "question": "Explain Hooke's Law and its limit of applicability.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Stress directly proportional to strain",
      "Proportionality limit threshold",
      "Modulus of elasticity definition"
    ],
    "keyConcepts": [
      {
        "concept": "Stress-strain proportionality",
        "importance": "high"
      },
      {
        "concept": "Elastic proportionality limit boundary",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_fund_003",
    "question": "Explain the difference between concrete compressive and tensile strength.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "High compressive loading strength",
      "Weak tensile loading strength (approx 10%)",
      "Need for steel reinforcement"
    ],
    "keyConcepts": [
      {
        "concept": "Compressive loading strength",
        "importance": "high"
      },
      {
        "concept": "Weak tensile strength reinforcement",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_fund_004",
    "question": "What is soil compaction and why is it required in geotechnical works?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Expelling air voids from soil mass",
      "Increasing dry density and load capacity",
      "Optimal Moisture Content (OMC)"
    ],
    "keyConcepts": [
      {
        "concept": "Volding air voids from soil",
        "importance": "high"
      },
      {
        "concept": "Dry density enhancement",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_fund_005",
    "question": "What is a truss structure and how does it transfer loads?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Pin-jointed frame structure",
      "Axial tension and compression members only",
      "Triangular geometry stability"
    ],
    "keyConcepts": [
      {
        "concept": "Axial member load transfers",
        "importance": "high"
      },
      {
        "concept": "Triangular geometric stability",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_fund_006",
    "question": "What is the purpose of surveying in civil construction?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Determining relative positions of points",
      "Establishing vertical/horizontal control networks",
      "Cut and fill volume calculations"
    ],
    "keyConcepts": [
      {
        "concept": "Establishing coordinate control systems",
        "importance": "high"
      },
      {
        "concept": "Cut and fill alignment calculations",
        "importance": "medium"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_001",
    "question": "Explain the difference between Working Stress Design and Limit State Design.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Factor of safety on service load vs partial safety factors on loads & materials",
      "Ultimate limit state and serviceability limit state",
      "Safety margins efficiency"
    ],
    "keyConcepts": [
      {
        "concept": "Partial material safety factors",
        "importance": "high"
      },
      {
        "concept": "Ultimate vs serviceability limit states",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_002",
    "question": "Explain the working principle and benefits of pre-stressed concrete.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Applying pre-compressive force to concrete prior to loading",
      "Tensioning steel tendons",
      "Eliminating tensile cracks under service loads"
    ],
    "keyConcepts": [
      {
        "concept": "Pre-compressive force introduction",
        "importance": "high"
      },
      {
        "concept": "Tendon tensioning procedure",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_003",
    "question": "Explain shear strength parameters of soil according to Mohr-Coulomb theory.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Cohesion parameter (c)",
      "Angle of internal friction (phi)",
      "Normal stress dependency"
    ],
    "keyConcepts": [
      {
        "concept": "Cohesion soil parameters",
        "importance": "high"
      },
      {
        "concept": "Angle of internal friction",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_004",
    "question": "Explain how the Marshall mix design method validates asphalt mixtures.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Compacting specimens at different binder contents",
      "Stability and flow tests",
      "Void analysis (VMA, VFA, Air Voids)"
    ],
    "keyConcepts": [
      {
        "concept": "Stability and flow limits validation",
        "importance": "high"
      },
      {
        "concept": "Void ratio optimizations VMA",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_005",
    "question": "Explain the hydraulic jump phenomenon in open channel flows.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "hard",
    "evaluationGuide": [
      "Transition from supercritical (Froude > 1) to subcritical flow",
      "High energy dissipation",
      "Depth change calculations"
    ],
    "keyConcepts": [
      {
        "concept": "Supercritical to subcritical flow jump",
        "importance": "high"
      },
      {
        "concept": "Energy dissipation efficiency",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_core_006",
    "question": "What is a moment-resisting frame in structural engineering?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Rigid beam-column connections",
      "Lateral load resistance (seismic/wind)",
      "Bending stiffness and ductility"
    ],
    "keyConcepts": [
      {
        "concept": "Rigid beam-column connections",
        "importance": "high"
      },
      {
        "concept": "Seismic lateral force resistance",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_001",
    "question": "How would you design a foundation for a skyscraper in soft clay soil?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Deep foundation selection (piles or rafts)",
      "Load transfer to hard stratum",
      "Settlement and friction calculations"
    ],
    "keyConcepts": [
      {
        "concept": "Deep pile foundation design",
        "importance": "high"
      },
      {
        "concept": "Differential settlement analysis",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_002",
    "question": "How would you mitigate the risk of concrete cracking during a mass concrete pour in hot summer?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Using chilled water or liquid nitrogen in mix",
      "Enforcing curing temperature controls",
      "Using low-heat cement (fly ash/slag replacements)"
    ],
    "keyConcepts": [
      {
        "concept": "Low-heat cement composition",
        "importance": "high"
      },
      {
        "concept": "Temperature gradient curing monitoring",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_003",
    "question": "Design a stormwater drainage system for a 50-hectare residential development.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Rational Method for runoff calculation",
      "Pipe capacity and sizing (Manning's formula)",
      "Retention basins design for peak mitigation"
    ],
    "keyConcepts": [
      {
        "concept": "Rational Method runoff estimation",
        "importance": "high"
      },
      {
        "concept": "Manning's pipe sizing equations",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_004",
    "question": "How would you reinforce an existing bridge to handle increased traffic loads?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "FRP composite wrapping of beams",
      "External post-tensioning installation",
      "Pier jacketing concrete reinforcement"
    ],
    "keyConcepts": [
      {
        "concept": "FRP wrapping reinforcement",
        "importance": "high"
      },
      {
        "concept": "External post-tensioning load relief",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_005",
    "question": "How would you troubleshoot a slow-moving landslide threatening a highway embankment?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Geotechnical soil monitoring (inclinometers)",
      "Installing deep subsoil drainage pipes",
      "Retaining wall or soil nailing construction"
    ],
    "keyConcepts": [
      {
        "concept": "Inclinometer displacement monitoring",
        "importance": "high"
      },
      {
        "concept": "Subsoil drainage dewatering design",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "ce_scen_006",
    "question": "Design a seismic retrofitting scheme for a historic brick masonry school building.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Concrete shear walls addition",
      "Base isolation bearings installation",
      "Steel tie-rods strapping"
    ],
    "keyConcepts": [
      {
        "concept": "Base isolation bearing layout",
        "importance": "high"
      },
      {
        "concept": "Masonry strapping configurations",
        "importance": "high"
      }
    ],
    "role": "CE",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
],
  IT: [
  {
    "id": "it_fund_001",
    "question": "Explain IP addressing and compare IPv4 with IPv6.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "32-bit vs 128-bit address space",
      "Decimal dot vs hexadecimal format",
      "Auto-configuration and security (IPSec) built-in"
    ],
    "keyConcepts": [
      {
        "concept": "Address space bit difference",
        "importance": "high"
      },
      {
        "concept": "Auto-configuration differences",
        "importance": "medium"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_fund_002",
    "question": "Explain the differences between TCP and UDP.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Connection-oriented vs Connectionless",
      "Reliable delivery (acknowledgments) vs Speed",
      "Header size variations"
    ],
    "keyConcepts": [
      {
        "concept": "Connection-oriented reliability",
        "importance": "high"
      },
      {
        "concept": "Speed priority connectionless UDP",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_fund_003",
    "question": "What is virtualization in IT systems?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Hypervisor software layer",
      "Running multiple OS instances on single hardware",
      "Resource isolation"
    ],
    "keyConcepts": [
      {
        "concept": "Hypervisor separation layer",
        "importance": "high"
      },
      {
        "concept": "Resource allocation isolation",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_fund_004",
    "question": "What is Active Directory and what role does it play in IT networks?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Centralized identity directory database",
      "Domain Controller validation",
      "Group Policy management"
    ],
    "keyConcepts": [
      {
        "concept": "Centralized identity database",
        "importance": "high"
      },
      {
        "concept": "Group Policy application",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_fund_005",
    "question": "What is a subnet mask and why is subnetting used?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "Network vs Host address segmentation",
      "Reducing broadcast traffic domain",
      "IP address optimization"
    ],
    "keyConcepts": [
      {
        "concept": "Network/Host division mapping",
        "importance": "high"
      },
      {
        "concept": "Broadcast domain reduction",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_fund_006",
    "question": "What is the purpose of a web server and how does it handle requests?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Fundamentals",
    "difficulty": "easy",
    "evaluationGuide": [
      "HTTP/HTTPS protocol parsing",
      "Static file serving vs proxying to application servers",
      "Request-response handling"
    ],
    "keyConcepts": [
      {
        "concept": "HTTP request-response cycle",
        "importance": "high"
      },
      {
        "concept": "Reverse proxy mapping",
        "importance": "medium"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Fundamentals",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_001",
    "question": "Explain the differences between RAID 0, RAID 1, RAID 5, and RAID 10.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Striping vs Mirroring vs Distributed Parity",
      "Fault tolerance limits",
      "Read/Write speed tradeoffs"
    ],
    "keyConcepts": [
      {
        "concept": "Distributed parity math (RAID 5)",
        "importance": "high"
      },
      {
        "concept": "Mirroring vs striping trade-offs",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_002",
    "question": "How does DHCP IP address allocation work?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "DORA process (Discover, Offer, Request, Acknowledge)",
      "Lease time limits",
      "Scope configurations"
    ],
    "keyConcepts": [
      {
        "concept": "DORA exchange sequence",
        "importance": "high"
      },
      {
        "concept": "DHCP lease renewals",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_003",
    "question": "Explain the role and mechanics of load balancers in high-availability environments.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Round Robin vs Least Connections routing",
      "SSL termination",
      "Health check monitoring probes"
    ],
    "keyConcepts": [
      {
        "concept": "Load balancing routing algorithms",
        "importance": "high"
      },
      {
        "concept": "Target health checking probes",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_004",
    "question": "What is Infrastructure as Code (IaC) and what are the benefits of tools like Terraform?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Declarative state definitions",
      "Version-controlled infrastructure",
      "Automation of resource provisioning"
    ],
    "keyConcepts": [
      {
        "concept": "Declarative state config",
        "importance": "high"
      },
      {
        "concept": "Idempotent resource provisioning",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_005",
    "question": "Explain the difference between Virtual Machines (VMs) and Containers.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Guest OS abstraction (VMs) vs Host Kernel sharing (Containers)",
      "Startup times and resource overhead",
      "Docker vs ESXi hypervisors"
    ],
    "keyConcepts": [
      {
        "concept": "Host OS kernel isolation",
        "importance": "high"
      },
      {
        "concept": "Hypervisor virtualization overhead",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_core_006",
    "question": "What is a Content Delivery Network (CDN) and how does it optimize speed?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Core",
    "difficulty": "medium",
    "evaluationGuide": [
      "Caching static content at edge servers",
      "Reducing latency (proximity to user)",
      "Reducing origin server load"
    ],
    "keyConcepts": [
      {
        "concept": "Edge server caching caching",
        "importance": "high"
      },
      {
        "concept": "Latency reduction proximity",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Core",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_001",
    "question": "How would you design a disaster recovery and backup strategy for a mission-critical database?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "RTO and RPO requirements definition",
      "Multi-region replication and cold storage backups",
      "Regular automated restore test schedules"
    ],
    "keyConcepts": [
      {
        "concept": "RTO and RPO limits definition",
        "importance": "high"
      },
      {
        "concept": "Automated restore drills verification",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_002",
    "question": "How would you diagnose a sudden network slowdown affecting a specific corporate office building?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Checking switch and router port utilization metrics",
      "Ping/traceroute latency tracing",
      "Packet analysis (Wireshark) to identify multicast storms"
    ],
    "keyConcepts": [
      {
        "concept": "Wireshark packet analysis diagnostics",
        "importance": "high"
      },
      {
        "concept": "Traceroute latency tracing",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_003",
    "question": "Design a secure network architecture for a company with 5 global branch offices.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "SD-WAN or Site-to-Site IPsec VPN tunnels",
      "Centralized firewall inspections",
      "Microsegmentation for server zones"
    ],
    "keyConcepts": [
      {
        "concept": "Site-to-Site IPsec VPN designs",
        "importance": "high"
      },
      {
        "concept": "Microsegmentation zones",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_004",
    "question": "How would you plan the migration of an on-premises core application to the public cloud?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Assess and Lift-and-Shift vs Refactoring",
      "Zero-downtime database replication (DMS)",
      "Rollback strategies and DNS cutovers"
    ],
    "keyConcepts": [
      {
        "concept": "Zero-downtime replication strategy",
        "importance": "high"
      },
      {
        "concept": "Rollback failover verification",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_005",
    "question": "Design a centralized logging and monitoring architecture for 100 virtual machines.",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Log forwarding agents (Fluentbit/Elastic Beats)",
      "Centralized indexer (Elasticsearch/Splunk)",
      "Dashboard alerting thresholds (Grafana)"
    ],
    "keyConcepts": [
      {
        "concept": "Elasticsearch indexer scalability",
        "importance": "high"
      },
      {
        "concept": "Log agent routing metrics",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  },
  {
    "id": "it_scen_006",
    "question": "How would you troubleshoot a widespread software update failure affecting 500 corporate laptops?",
    "topic": "Technical",
    "category": "Technical",
    "type": "Scenario",
    "difficulty": "hard",
    "evaluationGuide": [
      "Rolling back update deployment in MDM console",
      "Identifying root cause logs from representative client",
      "Deploying critical fix patch incrementally"
    ],
    "keyConcepts": [
      {
        "concept": "MDM rollbacks execution",
        "importance": "high"
      },
      {
        "concept": "Incremental ring deployments patch",
        "importance": "high"
      }
    ],
    "role": "IT",
    "interviewCategory": "Technical_Scenario",
    "isActive": true,
    "version": 1
  }
]
};

export const APTITUDE_QUESTION_BANK: any[] = [
  {
    "id": "apt_q_01",
    "question": "A train travels 120 km in 2 hours. What is its average speed?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "50 km/h",
      "60 km/h",
      "70 km/h",
      "80 km/h"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_02",
    "question": "If a shirt costing $20 is sold for $25, what is the profit percentage?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "10%",
      "20%",
      "25%",
      "30%"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_03",
    "question": "A can complete a work in 12 days and B can do it in 24 days. How many days will they take to complete it working together?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "6 days",
      "8 days",
      "10 days",
      "12 days"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_04",
    "question": "If 15% of a number is 45, what is 40% of that number?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "100",
      "120",
      "150",
      "180"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_05",
    "question": "What is the average of the first five prime numbers?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "5.0",
      "5.6",
      "6.2",
      "7.0"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_06",
    "question": "A sum of money doubles itself in 8 years at simple interest. What is the annual rate of interest?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "10%",
      "12.5%",
      "15%",
      "20%"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_07",
    "question": "In how many different ways can the letters of the word 'LEADER' be arranged?",
    "category": "Quantitative",
    "difficulty": "hard",
    "options": [
      "720",
      "360",
      "120",
      "48"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_08",
    "question": "Two cards are drawn together from a pack of 52 cards. What is the probability that one is a spade and one is a heart?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "13/51",
      "13/102",
      "26/51",
      "1/4"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_09",
    "question": "Find the ratio of 90 cm to 1.5 m.",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "3:5",
      "5:3",
      "3:4",
      "4:3"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_10",
    "question": "The difference between simple and compound interest on $2000 for 2 years at 10% per annum is:",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "$10",
      "$20",
      "$40",
      "$50"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_11",
    "question": "A cylinder has a radius of 7 cm and a height of 10 cm. What is its volume? (Use pi = 22/7)",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "154 cm3",
      "1540 cm3",
      "770 cm3",
      "3080 cm3"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_12",
    "question": "If 12 men or 18 women can build a wall in 14 days, in how many days can 8 men and 16 women build it?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "7 days",
      "9 days",
      "10 days",
      "12 days"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_13",
    "question": "A speed of 54 km/h is equal to how many meters per second?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "10 m/s",
      "15 m/s",
      "20 m/s",
      "25 m/s"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_14",
    "question": "A bag contains 6 black and 8 white balls. One ball is drawn at random. What is the probability that the ball drawn is white?",
    "category": "Quantitative",
    "difficulty": "hard",
    "options": [
      "3/7",
      "4/7",
      "1/8",
      "1/14"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_15",
    "question": "By selling a book for $115, a retailer gains 15%. What was the cost price of the book?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "$90",
      "$100",
      "$110",
      "$120"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_16",
    "question": "If log 2 = 0.3010 and log 3 = 0.4771, what is the value of log 5?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "0.3210",
      "0.6990",
      "0.7781",
      "0.8451"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_17",
    "question": "Three unbiased coins are tossed. What is the probability of getting at least 2 heads?",
    "category": "Quantitative",
    "difficulty": "hard",
    "options": [
      "1/4",
      "3/8",
      "1/2",
      "5/8"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_18",
    "question": "Calculate the sum: 1 + 2 + 3 + ... + 50.",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "1225",
      "1275",
      "1300",
      "1350"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_19",
    "question": "A student has to secure 40% marks to pass. He gets 178 marks and fails by 22 marks. What are the maximum marks?",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "400",
      "500",
      "600",
      "700"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_20",
    "question": "Find the compound interest on $10,000 for 1 year at 20% per annum, compounded half-yearly.",
    "category": "Quantitative",
    "difficulty": "hard",
    "options": [
      "$2000",
      "$2100",
      "$2200",
      "$2400"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_21",
    "question": "What is the value of (256)^0.16 * (256)^0.09?",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "2",
      "4",
      "16",
      "64"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_22",
    "question": "A boat can travel with a speed of 13 km/h in still water. If the speed of the stream is 4 km/h, find the time taken by the boat to go 68 km downstream.",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_23",
    "question": "The ages of two persons A and B are in the ratio 5:7. Eighteen years ago their ages were in the ratio 8:13. Find their present ages.",
    "category": "Quantitative",
    "difficulty": "hard",
    "options": [
      "30 and 42 years",
      "40 and 56 years",
      "50 and 70 years",
      "60 and 84 years"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_24",
    "question": "A shopkeeper bought a cycle for $1200 and sold it for $1500. Find his gain percentage.",
    "category": "Quantitative",
    "difficulty": "easy",
    "options": [
      "15%",
      "20%",
      "25%",
      "30%"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_25",
    "question": "In a mixture of 60 liters, the ratio of milk and water is 2:1. If this ratio is to be 1:2, then the quantity of water to be further added is:",
    "category": "Quantitative",
    "difficulty": "medium",
    "options": [
      "20 liters",
      "30 liters",
      "40 liters",
      "60 liters"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_26",
    "question": "Find the next shape in the pattern:\n[ □ ]\n[ △ ]\n[ ○ ]\n[ ? ]",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "[ ☆ ]",
      "[ ▽ ]",
      "[ □ ]",
      "[ ⬡ ]"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_27",
    "question": "Find the next number in the series: 2, 4, 8, 16, ?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "24",
      "30",
      "32",
      "36"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_28",
    "question": "If in a certain language, CHARCOAL is coded as 45162913, how is COAL coded?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "4913",
      "4213",
      "4513",
      "4613"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_29",
    "question": "Pointing to a photograph, a man said, 'I have no brother or sister but that man's father is my father's son.' Whose photograph was it?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "His nephew's",
      "His son's",
      "His father's",
      "His own"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_30",
    "question": "A man walks 5 km East, then turns right and walks 4 km, then turns left and walks 5 km. Which direction is he facing now?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "North",
      "South",
      "East",
      "West"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_31",
    "question": "Six friends A, B, C, D, E, and F are sitting in a circle facing the center. F is to the immediate left of A. B is opposite to E. C is opposite to D. Who is sitting to the immediate right of E?",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "A",
      "B",
      "F",
      "Cannot be determined"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_32",
    "question": "Identify the missing element in the sequence: A1, C3, E5, G7, ?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "H8",
      "I9",
      "J10",
      "I11"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_33",
    "question": "In a certain code, 'TIGER' is written as 'SUHJFHDFQS'. How is 'CAT' written?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "BDZBSU",
      "BDFHJL",
      "BDBZSU",
      "BDBZQS"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_34",
    "question": "Find the odd one out: 27, 64, 125, 144, 216",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "64",
      "125",
      "144",
      "216"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_35",
    "question": "If A + B means A is the brother of B; A - B means A is the sister of B; and A * B means A is the father of B. Which of the following means P is the nephew of Q?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "Q - R + P",
      "Q - R * P",
      "P - R * Q",
      "Cannot be determined"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_36",
    "question": "Find the next figure in the pattern:\n◯ ◯◯ ◯◯◯\n△ △△ △△△\n□ □□ [ ? ]",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "□□□□",
      "□□□",
      "◯",
      "△"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_37",
    "question": "Which of the following diagrams correctly represents the relationship among: Writers, Researchers, and Teachers?",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "Three intersecting circles representing partial overlap",
      "Three nested circles",
      "Two separate circles inside a larger one",
      "Three completely separated circles"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_38",
    "question": "If 'Blue' is called 'Green', 'Green' is called 'White', 'White' is called 'Black', 'Black' is called 'Red', and 'Red' is called 'Yellow', what is the color of milk?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "White",
      "Green",
      "Black",
      "Red"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_39",
    "question": "Find the missing number in the sequence: 3, 5, 9, 17, ?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "25",
      "29",
      "31",
      "33"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_40",
    "question": "Statements:\n1. All mangoes are golden.\n2. No golden things are cheap.\nConclusions:\nI. All mangoes are cheap.\nII. Golden things are cheap.",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "Only I follows",
      "Only II follows",
      "Neither I nor II follows",
      "Both I and II follow"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_41",
    "question": "Select the correct mirror image of the word 'EASY' when the mirror is placed to its right.",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "YSAE (reversed letters)",
      "YS AE",
      "EASY",
      "None of these"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_42",
    "question": "Complete the analogy: Eye : Wink :: Heart : ?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "Throb",
      "Pump",
      "Blood",
      "Beat"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_43",
    "question": "Find the next element: Z, X, V, T, R, ?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "P",
      "Q",
      "O",
      "N"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_44",
    "question": "A clock shows 3:00. If the minute hand points North-East, in which direction does the hour hand point?",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "South-East",
      "South-West",
      "North-West",
      "East"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_45",
    "question": "If 1st January of a non-leap year is Sunday, what day will it be on 31st December of the same year?",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "Sunday",
      "Monday",
      "Saturday",
      "Friday"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_46",
    "question": "What is the missing number in the matrix?\n┌───┬───┬───┐\n│ 2 │ 4 │ 8 │\n├───┼───┼───┤\n│ 3 │ 9 │27 │\n├───┼───┼───┤\n│ 4 │16 │ ? │\n└───┴───┴───┘",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "32",
      "48",
      "64",
      "80"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_47",
    "question": "Identify the missing shape:\n[ ○ ] -> [ ◯ ◯ ]\n[ △ ] -> [ △ △ ]\n[ □ ] -> [  ?  ]",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "[ □ □ ]",
      "[ □ ]",
      "[ ⬡ ]",
      "[ ◯ ]"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_48",
    "question": "Find the odd word out: Apple, Orange, Banana, Potato",
    "category": "Logical",
    "difficulty": "easy",
    "options": [
      "Apple",
      "Orange",
      "Banana",
      "Potato"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_49",
    "question": "If 'A' is substituted by 2, 'B' by 4, 'C' by 6 and so on, what will be the total value of the word 'CAB'?",
    "category": "Logical",
    "difficulty": "medium",
    "options": [
      "10",
      "12",
      "14",
      "16"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_50",
    "question": "Arrange the following words in a meaningful sequence:\n1. Key  2. Door  3. Lock  4. Room  5. Switch on",
    "category": "Logical",
    "difficulty": "hard",
    "options": [
      "1, 3, 2, 4, 5",
      "5, 1, 2, 4, 3",
      "1, 2, 3, 5, 4",
      "1, 3, 2, 5, 4"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_51",
    "question": "Based on the table below, which company had the highest sales in Q2?\n┌─────────┬────┬────┐\n│ Company │ Q1 │ Q2 │\n├─────────┼────┼────┤\n│ Alpha   │ 100│ 150│\n│ Beta    │ 120│ 140│\n│ Gamma   │  90│ 160│\n└─────────┴────┴────┘",
    "category": "Analytical",
    "difficulty": "easy",
    "options": [
      "Alpha",
      "Beta",
      "Gamma",
      "All equal"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_52",
    "question": "In a pie chart representing expenses of $2000, rent is 35%. How much money is spent on rent?",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "$500",
      "$600",
      "$700",
      "$800"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_53",
    "question": "If the total revenue of a store over 3 months is $3000, $4000, and $5000, what is the percentage growth from month 1 to month 3?",
    "category": "Analytical",
    "difficulty": "easy",
    "options": [
      "33.3%",
      "50%",
      "66.7%",
      "100%"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_54",
    "question": "Study the diagram:\n[Total Budget]\n  ├─ Tech: 40%\n  ├─ Marketing: 30%\n  └─ HR: 30%\nIf HR budget is $15,000, what is the Tech budget?",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "$15,000",
      "$20,000",
      "$25,000",
      "$30,000"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_55",
    "question": "A research group has 5 members. If every member shakes hands with every other member exactly once, what is the total number of handshakes?",
    "category": "Analytical",
    "difficulty": "hard",
    "options": [
      "10",
      "15",
      "20",
      "25"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_56",
    "question": "If Company X's profit ratio (Profit/Expense) is 0.25 and expenses are $80,000, what is their revenue? (Revenue = Expense + Profit)",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "$80,000",
      "$100,000",
      "$120,000",
      "$140,000"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_57",
    "question": "Based on the table, what is the average score of Student B?\n┌─────────┬────────┬─────────┐\n│ Student │ Math   │ Science │\n├─────────┼────────┼─────────┤\n│ A       │  80    │   90    │\n│ B       │  70    │   80    │\n└─────────┴────────┴─────────┘",
    "category": "Analytical",
    "difficulty": "easy",
    "options": [
      "70",
      "75",
      "80",
      "85"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_58",
    "question": "A production line produces 240 units per hour. If the error rate is 2.5%, how many defective units are produced in an 8-hour shift?",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "24",
      "36",
      "48",
      "60"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_59",
    "question": "If 3 painters can paint 3 houses in 3 days, how many days does it take 1 painter to paint 1 house?",
    "category": "Analytical",
    "difficulty": "hard",
    "options": [
      "1 day",
      "3 days",
      "9 days",
      "None of these"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_60",
    "question": "In a group of 50 people, 35 speak English, 20 speak French, and 10 speak both. How many speak neither language?",
    "category": "Analytical",
    "difficulty": "easy",
    "options": [
      "5",
      "10",
      "15",
      "20"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_61",
    "question": "A train passes a station platform 100 meters long in 10 seconds, and passes a pole in 6 seconds. What is the length of the train?",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "100 m",
      "150 m",
      "200 m",
      "250 m"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_62",
    "question": "From a container of 80 liters of milk, 8 liters is replaced by water. This process is repeated one more time. How much milk remains?",
    "category": "Analytical",
    "difficulty": "hard",
    "options": [
      "64 liters",
      "64.8 liters",
      "72 liters",
      "68.4 liters"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_63",
    "question": "If 4 workers can pack 40 boxes in 2 hours, what is the packing rate per worker per hour?",
    "category": "Analytical",
    "difficulty": "easy",
    "options": [
      "2 boxes/hr",
      "5 boxes/hr",
      "10 boxes/hr",
      "20 boxes/hr"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_64",
    "question": "If the price of petroleum increases by 25%, by how much percent must a driver reduce consumption to keep expenditure constant?",
    "category": "Analytical",
    "difficulty": "medium",
    "options": [
      "15%",
      "20%",
      "25%",
      "30%"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_65",
    "question": "A family has two children. Given that at least one of them is a boy, what is the probability that both are boys?",
    "category": "Analytical",
    "difficulty": "hard",
    "options": [
      "1/3",
      "1/2",
      "2/3",
      "3/4"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_66",
    "question": "Choose the correct synonym for: 'ABANDON'",
    "category": "Verbal",
    "difficulty": "easy",
    "options": [
      "Keep",
      "Leave",
      "Adopt",
      "Cherish"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_67",
    "question": "Choose the correct antonym for: 'LOQUACIOUS'",
    "category": "Verbal",
    "difficulty": "easy",
    "options": [
      "Silent",
      "Talkative",
      "Friendly",
      "Beautiful"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_68",
    "question": "Identify the grammatical error in the sentence:\n'Each of the students have completed their assignment.'",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "Each of the",
      "students have",
      "completed",
      "their assignment"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_69",
    "question": "Rearrange the following sentences to make a logical paragraph:\nP: They are key sources of energy.\nQ: Carbohydrates are organic compounds.\nR: They include sugars and starches.",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "Q, R, P",
      "P, Q, R",
      "Q, P, R",
      "R, P, Q"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_70",
    "question": "Complete the sentence: She is very keen _______ visiting the museum.",
    "category": "Verbal",
    "difficulty": "easy",
    "options": [
      "on",
      "at",
      "for",
      "with"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_71",
    "question": "Choose the correct spelling of the word:",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "Accomodation",
      "Accommodation",
      "Acomodation",
      "Accomodasion"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_72",
    "question": "Identify the passive voice version of: 'The chef cooked a delicious dinner.'",
    "category": "Verbal",
    "difficulty": "hard",
    "options": [
      "A delicious dinner was cooked by the chef.",
      "A delicious dinner is cooked by the chef.",
      "Dinner is being cooked by the chef.",
      "The dinner was cooking by the chef."
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_73",
    "question": "What is the meaning of the idiom: 'Spill the beans'?",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "To drop food",
      "To reveal a secret",
      "To perform a task poorly",
      "To start a fight"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_74",
    "question": "Read the text and answer: 'All trees need water. An oak is a tree.' Does the oak need water?",
    "category": "Verbal",
    "difficulty": "hard",
    "options": [
      "Yes, definitely",
      "No, it does not",
      "Cannot be determined",
      "Only in summer"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_75",
    "question": "Choose the closest antonym for: 'EPHEMERAL'",
    "category": "Verbal",
    "difficulty": "easy",
    "options": [
      "Short-lived",
      "Permanent",
      "Weak",
      "Fast"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_76",
    "question": "Complete the sentence: Neither of the answers _______ correct.",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "is",
      "are",
      "were",
      "been"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_77",
    "question": "Choose the correct idiom meaning for: 'Burn the midnight oil'",
    "category": "Verbal",
    "difficulty": "hard",
    "options": [
      "To waste fuel",
      "To study or work late into the night",
      "To cause an accident",
      "To sleep early"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_78",
    "question": "Fill in the blank: The train ________ before I reached the station.",
    "category": "Verbal",
    "difficulty": "easy",
    "options": [
      "left",
      "had left",
      "was leaving",
      "leaves"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_79",
    "question": "What is the meaning of: 'PRAGMATIC'?",
    "category": "Verbal",
    "difficulty": "medium",
    "options": [
      "Idealistic",
      "Practical",
      "Stubborn",
      "Careless"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  },
  {
    "id": "apt_q_80",
    "question": "Complete the sentence: If I _______ you, I would accept the job offer.",
    "category": "Verbal",
    "difficulty": "hard",
    "options": [
      "was",
      "were",
      "am",
      "would be"
    ],
    "timeLimit": 60,
    "evaluationGuide": [
      "Explain the core concept or select the correct option directly."
    ],
    "role": "APTITUDE",
    "isActive": true,
    "version": 1
  }
];

export class QuestionRepository {
  static getCommonQuestions(): Question[] {
    return COMMON_QUESTION_BANK.filter(q => q.isActive);
  }

  static getTechnicalQuestions(role: InterviewRole): Question[] {
    const bank = (TECHNICAL_BANKS[role] && TECHNICAL_BANKS[role].length > 0) ? TECHNICAL_BANKS[role] : (TECHNICAL_BANKS['CSE'] || []);
    return bank.filter(q => q.isActive);
  }

  static getByCategory(category: QuestionCategory, role?: InterviewRole): Question[] {
    if (category.startsWith('Technical_')) {
      if (!role) {
        throw new Error("Role must be provided to query technical categories");
      }
      return this.getTechnicalQuestions(role).filter(q => q.interviewCategory === category);
    }
    return this.getCommonQuestions().filter(q => q.interviewCategory === category);
  }

  static getByDifficulty(difficulty: Difficulty, category?: QuestionCategory, role?: InterviewRole): Question[] {
    let list: Question[] = [];
    if (category) {
      list = this.getByCategory(category, role);
    } else {
      list = role ? this.getTechnicalQuestions(role) : this.getCommonQuestions();
    }
    return list.filter(q => q.difficulty === difficulty);
  }

  static getActiveQuestions(role?: InterviewRole): Question[] {
    if (role) {
      return [...this.getCommonQuestions(), ...this.getTechnicalQuestions(role)];
    }
    return this.getCommonQuestions();
  }
}
