import {
  CameraProvider,
  CameraProviderListener,
  CameraProviderStatus,
  RawDetectionFrame,
  HeartbeatMetrics,
  ProctoringConfiguration,
} from '../../../../types';

/**
 * LocalCameraProvider — CameraProvider implementation for the built-in webcam.
 *
 * Strategy: Try getUserMedia(video) first. Only throw on specific errors
 * (NotFoundError, NotReadableError, NotAllowedError) that indicate the camera
 * is genuinely unavailable, triggering the phone fallback in the caller.
 *
 * This provider provides the MediaStream for both preview (CameraPreview)
 * and analysis (CameraAnalysis, which runs MediaPipe on desktop).
 */
export class LocalCameraProvider implements CameraProvider {
  readonly type = 'local_webcam' as const;

  private stream: MediaStream | null = null;
  private listeners: CameraProviderListener[] = [];
  private status: CameraProviderStatus = {
    connected: false,
    fps: 0,
    thermal: 'normal',
  };
  private disposed = false;

  /**
   * Request camera + microphone permissions and establish the stream.
   * Throws if the webcam is not available, triggering phone fallback.
   */
  async initialize(config?: ProctoringConfiguration): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: true,
      });

      this.status = { connected: true, fps: 30, thermal: 'normal' };
      console.log('[LocalCameraProvider] Camera initialized successfully');

      // Watch for track ending (e.g., user unplugs webcam)
      this.stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          console.warn('[LocalCameraProvider] Video track ended');
          this.status = { ...this.status, connected: false, fps: 0 };
          this.listeners.forEach(l => l.onError({ code: 'CAMERA_LOST', reason: 'Video track ended' }));
          this.listeners.forEach(l => l.onStatusChange(this.status));
        };
      });

    } catch (error: any) {
      const errorName = error.name || '';
      console.error(`[LocalCameraProvider] Camera init failed: ${errorName}`, error);

      // Re-throw with the original error name so the caller can classify it
      // and decide whether to fall back to phone camera
      if (['NotFoundError', 'NotReadableError', 'NotAllowedError'].includes(errorName)) {
        throw error;
      }

      // For unknown errors, also throw but with a descriptive message.
      // `cause` retains the original DOMException so the failure remains diagnosable.
      throw new Error(`Camera initialization failed: ${errorName || error.message}`, { cause: error });
    }
  }

  /**
   * Signal that analysis should begin. The actual MediaPipe loop is driven
   * by CameraAnalysis component, which calls subscribe() to receive events.
   */
  start(): void {
    if (!this.stream) {
      console.warn('[LocalCameraProvider] Cannot start — no stream');
      return;
    }
    console.log('[LocalCameraProvider] Started');
  }

  stop(): void {
    console.log('[LocalCameraProvider] Stopped');
  }

  getPreviewStream(): MediaStream | null {
    return this.stream;
  }

  getStatus(): CameraProviderStatus {
    return { ...this.status };
  }

  subscribe(listener: CameraProviderListener): void {
    this.listeners.push(listener);
  }

  /**
   * Called by CameraAnalysis when it produces a detection frame.
   * Forwards to all subscribers.
   */
  emitDetectionFrame(frame: RawDetectionFrame): void {
    this.listeners.forEach(l => l.onDetectionFrame(frame));
  }

  /**
   * Called by CameraAnalysis when it produces heartbeat metrics.
   * Updates internal FPS tracking and forwards to subscribers.
   */
  emitHeartbeat(metrics: HeartbeatMetrics): void {
    this.status = { ...this.status, fps: metrics.fps };
    this.listeners.forEach(l => l.onHeartbeat(metrics));
    this.listeners.forEach(l => l.onStatusChange(this.status));
  }

  /**
   * Called when CameraAnalysis engine is ready.
   */
  emitEngineReady(): void {
    this.listeners.forEach(l => l.onEngineReady());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.listeners = [];
    this.status = { connected: false, fps: 0, thermal: 'normal' };
    console.log('[LocalCameraProvider] Disposed');
  }
}
