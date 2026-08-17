/**
 * Lightweight request coordinator for the frontend to prevent accidental bursts,
 * identical concurrent requests, and handle UI-side debouncing.
 * This is about UX and efficiency, not security (which is handled by Edge Functions).
 */
export class RequestCoordinator {
  private static pendingRequests = new Map<string, Promise<any>>();
  private static lastRequestTimes = new Map<string, number>();
  private static readonly DEBOUNCE_MS = 500; // Prevent rapid identical calls within 500ms

  /**
   * Executes a request while preventing duplicate concurrent requests.
   * If a request with the exact same key is already in flight, returns the existing promise.
   * 
   * @param key Unique identifier for the request (e.g., hash of the prompt or 'action:target')
   * @param requestFn The async function to execute
   * @returns The result of the request
   */
  public static async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const lastTime = this.lastRequestTimes.get(key) || 0;

    // Debounce: reject if called too quickly after completion
    if (now - lastTime < this.DEBOUNCE_MS && !this.pendingRequests.has(key)) {
      throw new Error(`RequestCoordinator: Debounced rapid request for key [${key}]`);
    }

    // Deduplicate: join existing in-flight request
    if (this.pendingRequests.has(key)) {
       console.warn(`[RequestCoordinator] Joining existing in-flight request for: ${key}`);
       return this.pendingRequests.get(key) as Promise<T>;
    }

    // Execute new request
    const promise = requestFn().finally(() => {
       this.pendingRequests.delete(key);
       this.lastRequestTimes.set(key, Date.now());
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }
}
