export enum EventType {
  INTERVIEW_STARTED = 'INTERVIEW_STARTED',
  STATE_TRANSITION = 'STATE_TRANSITION',
  QUESTION_DISPLAYED = 'QUESTION_DISPLAYED',
  ANSWER_RECEIVED = 'ANSWER_RECEIVED',
  EVALUATION_COMPLETED = 'EVALUATION_COMPLETED',
  FOLLOW_UP_GENERATED = 'FOLLOW_UP_GENERATED',
  INTERVIEW_COMPLETED = 'INTERVIEW_COMPLETED',
  ERROR = 'ERROR'
}

export class EventLogger {
  /**
   * Outputs structured JSON logs for backend observability instead of raw strings.
   */
  static log(eventType: EventType, sessionId: string, payload: any = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      sessionId,
      payload
    };
    
    // Always use structured JSON
    console.log(JSON.stringify(logEntry));
  }
}
