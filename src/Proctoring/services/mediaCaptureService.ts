export class RollingRecorder {
  private stream: MediaStream;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;
  private mimeType: string;
  
  // --- ROLLING BUFFER LOGIC ---
  private segments: Blob[] = []; // Stores completed 10s video segments
  private maxSegments = 2;       // Keep max 2 segments in memory (20 seconds of history)
  private segmentDurationMs = 10000; // 10 seconds per segment
  private segmentTimer: ReturnType<typeof setTimeout> | null = null;

  private stopResolver: ((blob: Blob | null) => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
    
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      this.mimeType = 'video/webm;codecs=vp9,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      this.mimeType = 'video/webm;codecs=vp8,opus';
    } else {
      this.mimeType = 'video/webm';
    }

    this.initializeRecorder();
  }

  private initializeRecorder(): void {
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.segments.push(blob);
        
        // Maintain the rolling window (drop oldest segments to save memory)
        while (this.segments.length > this.maxSegments) {
          this.segments.shift();
        }
        this.chunks = [];
      }

      // If this stop was triggered by captureClip(), resolve the promise
      if (this.stopResolver) {
        const finalBlob = this.segments.pop() || null;
        this.isRecording = false;
        this.stopResolver(finalBlob);
        this.stopResolver = null;
      } 
      // Otherwise, if we are still supposed to be recording, restart for the next 10s segment
      else if (this.isRecording) {
        this.startInternal();
      }
    };

    this.mediaRecorder.onerror = (event: Event) => {
      console.error("[Recorder] MediaRecorder error:", event);
      if (this.stopResolver) {
        this.stopResolver(null);
        this.stopResolver = null;
      }
    };
  }

  private startInternal(): void {
    if (!this.mediaRecorder) return;
    this.chunks = [];
    this.mediaRecorder.start(1000); // Collect data every 1 second
    
    // Set a timer to automatically stop the recorder and create a segment
    this.segmentTimer = setTimeout(() => {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop(); 
      }
    }, this.segmentDurationMs);
  }

  public start(): void {
    if (this.isRecording) return;
    this.isRecording = true;
    this.segments = [];
    this.startInternal();
  }

  public async captureClip(): Promise<Blob | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;

    // Clear the automatic segment timer so it doesn't interfere
    if (this.segmentTimer) {
      clearTimeout(this.segmentTimer);
      this.segmentTimer = null;
    }

    return new Promise((resolve) => {
      this.stopResolver = (blob) => resolve(blob);

      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      } else {
        resolve(this.segments.pop() || null);
      }
    });
  }

  public resume(): void {
    if (this.mediaRecorder?.state === 'recording') return;
    this.isRecording = true;
    this.startInternal();
  }

  public destroy(): void {
    this.isRecording = false;
    if (this.segmentTimer) clearTimeout(this.segmentTimer);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.stream.getTracks().forEach(track => track.stop());
  }
}

// ==========================================
// 4. RESTORED SNAPSHOT LOGIC
// ==========================================
export class MediaCaptureService {
  static async captureSnapshot(videoElement: HTMLVideoElement): Promise<Blob> {
  if (!videoElement) {
    throw new Error('Video element is not ready');
  }

  // Wait for video to be ready
  if (videoElement.readyState < 2) {
    await new Promise<void>((resolve) => {
      const handler = () => { videoElement.removeEventListener('canplay', handler); resolve(); };
      videoElement.addEventListener('canplay', handler);
      setTimeout(resolve, 3000);
    });
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture snapshot blob'));
        }
      }, 'image/jpeg', 0.8);
    } else {
      reject(new Error('Failed to get canvas 2d context'));
    }
  });
}
}

// ==========================================
// 5. BULLETPROOF UPLOAD MANAGER (Tasks 1, 2, 3, 4)
// ==========================================
export class UploadManager {
  private queue: Array<{ id: string; task: () => Promise<void>; resolve: () => void; reject: (err: any) => void }> = [];
  private activeUploads = 0;
  private maxConcurrent = 2; // Task 1: Limit concurrent uploads to prevent browser freezing
  private processedIds = new Set<string>(); // Task 3: Prevent duplicate uploads

  /**
   * Enqueues an upload. 
   * @param id Unique ID (use violation.id) to prevent duplicates.
   * @param uploadFn The actual upload function to execute.
   */
  public enqueue<T>(id: string, uploadFn: () => Promise<T>): Promise<T> {
    // Task 3: Deduplication check
    if (this.processedIds.has(id)) {
      return Promise.resolve(null as any); 
    }
    this.processedIds.add(id);

    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        task: async () => {
          const startTime = performance.now(); // Task 4: Performance tracking
          
          // Task 2: Retry logic with exponential backoff
          let retries = 3;
          while (retries > 0) {
            try {
              const result = await uploadFn();
              const duration = Math.round(performance.now() - startTime);
              resolve(result);
              return;
            } catch (err) {
              retries--;
              if (retries === 0) {
                this.processedIds.delete(id); // Allow manual retry later if needed
                reject(err);
              } else {
                console.warn(`[UploadManager] ⚠️ Retry ${3 - retries} for ${id}...`);
                await new Promise(r => setTimeout(r, 2000 * (3 - retries))); // Backoff
              }
            }
          }
        },
        resolve: resolve as any,
        reject
      });
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.activeUploads < this.maxConcurrent && this.queue.length > 0) {
      this.activeUploads++;
      const item = this.queue.shift()!;
      
      item.task()
        .then(() => item.resolve())
        .catch((err) => item.reject(err))
        .finally(() => {
          this.activeUploads--;
          this.processQueue(); // Process next in queue
        });
    }
  }
}

// Export a singleton instance to use across your app
export const uploadManager = new UploadManager();