/**
 * Typed Event Emitter for Session & Evaluation State Refreshing
 */

export type SessionUpdatedPayload = {
  sessionId: string;
  candidateId?: string;
  action: 'created' | 'updated' | 'evaluation-updated';
};

type Listener = (payload: SessionUpdatedPayload) => void;

class SessionEventEmitter {
  private listeners: Set<Listener> = new Set();

  public on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public off(listener: Listener): void {
    this.listeners.delete(listener);
  }

  public emit(payload: SessionUpdatedPayload): void {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[sessionEvents] Listener error:', err);
      }
    });
  }
}

export const sessionEvents = new SessionEventEmitter();
