import { supabase } from '../../Core/database/supabaseClient';
import { SupabaseService } from '../../Core/database/supabaseService';
import { mediaPipeService } from './mediaPipeService';
import {
  ProctorMessage,
  ProctorMessageType,
  PhoneConnectedPayload,
  DetectionFramePayload,
  HeartbeatPayload,
  WebRTCSignalPayload,
  MediaUploadedPayload,
  PROCTOR_PROTOCOL_VERSION,
  PHONE_PROCTORING,
  RawDetectionFrame,
  HeartbeatMetrics,
} from '../../../types';
import { RollingRecorder } from './mediaCaptureService';

/**
 * MobileProctorService — Runs on the phone browser.
 * Orchestrates:
 * 1. Token resolution and session binding.
 * 2. Camera + MediaPipe initialization (3fps).
 * 3. Supabase Realtime for protocol events.
 * 4. WebRTC video streaming (initiates offer to desktop).
 * 5. RollingRecorder for violation media capture.
 */
export class MobileProctorService {
  private sessionId: string | null = null;
  private connectionId: string;
  private channel: any = null;
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private disposed = false;

  // Sequence tracking
  private phoneSequence = 0;
  private lastReceivedSequence = 0;

  // MediaPipe
  private processingLoop: ReturnType<typeof setInterval> | null = null;
  private targetFps = PHONE_PROCTORING.DETECTION_FPS;

  // Heartbeat loop
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatCount = 0;

  // Battery
  private batteryLevel: number | null = null;
  private batteryManager: any = null;

  // WebRTC
  private peerConnection: RTCPeerConnection | null = null;

  // RollingRecorder
  private rollingRecorder: RollingRecorder | null = null;

  // ACK tracking
  private pendingAcks = new Map<number, {
    retries: number;
    timer: ReturnType<typeof setTimeout>;
    message: ProctorMessage;
  }>();

  // Callbacks for the UI
  private onStatusUpdate: ((status: MobileProctorStatus) => void) | null = null;
  private onDetectionFrame: ((frame: RawDetectionFrame) => void) | null = null;

  constructor() {
    this.connectionId = `phone_${crypto.randomUUID().slice(0, 8)}`;
  }

  // ─── Public Interface ────────────────────────────────────────────────

  /**
   * Initialize the service: resolve token, set up camera, MediaPipe, Realtime, WebRTC.
   */
  async initialize(token: string): Promise<{
    sessionId: string;
    candidateName: string;
  }> {
    if (!supabase) throw new Error('Supabase not initialized');

    // 1. Resolve token → session
    const session = await SupabaseService.getSessionFromToken(token);
    if (!session) {
      throw new Error('Invalid or expired token');
    }
    this.sessionId = session.sessionId;

    // 2. Consume token (one-time use)
    const consumed = await SupabaseService.consumePairingToken(token, this.connectionId);
    if (!consumed) {
      throw new Error('Token already used');
    }

    // 3. Request camera
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
        audio: false, // Audio is on the desktop
      });
    } catch (error: any) {
      // `cause` preserves the original DOMException (NotAllowedError, NotReadableError, …).
      // Without it the underlying reason a camera failed to open was lost at the rethrow, leaving
      // only a formatted string and no stack to diagnose from.
      throw new Error(`Camera access failed: ${error.name || error.message}`, { cause: error });
    }

    // 4. Init battery monitoring
    await this.initBattery();

    // 5. Join Realtime channel
    this.channel = supabase.channel(`proctoring:${this.sessionId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel.on('broadcast', { event: 'proctor_message' }, (payload: any) => {
      if (this.disposed) return;
      this.handleMessage(payload.payload as ProctorMessage);
    });

    await this.channel.subscribe();

    // Start independent heartbeat loop
    this.startHeartbeatLoop();

    // Broadcast PHONE_CONNECTED
    this.broadcastMessage('PHONE_CONNECTED', {
      connectionId: this.connectionId,
      batteryLevel: this.batteryLevel,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    } as PhoneConnectedPayload);

    // Initiate WebRTC connection (phone is offerer)
    this.initiateWebRTC();

    console.log(`[MobileProctorService] Initialized. Session: ${this.sessionId}, Connection: ${this.connectionId}`);

    return session;
  }

  /**
   * Start MediaPipe processing and heartbeat emission.
   */
  async start(): Promise<void> {
    // Init MediaPipe
    await mediaPipeService.preload();

    // Create hidden video element for MediaPipe processing
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = this.stream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;
    await this.videoElement.play();

    // Init RollingRecorder
    if (this.stream) {
      this.rollingRecorder = new RollingRecorder(this.stream);
    }

    // Start processing loop
    this.startProcessingLoop();

    console.log('[MobileProctorService] Started processing at', this.targetFps, 'fps');
  }

  /**
   * Stop processing without disposing.
   */
  stop(): void {
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
      this.processingLoop = null;
    }
  }

  /**
   * Tear down everything.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stop();

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Broadcast disconnect
    this.broadcastMessage('PHONE_DISCONNECTED', {});

    // Clear ACK timers
    this.pendingAcks.forEach(({ timer }) => clearTimeout(timer));
    this.pendingAcks.clear();

    // Close WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }

    // Cleanup recorder
    if (this.rollingRecorder) {
      this.rollingRecorder.destroy();
      this.rollingRecorder = null;
    }

    // Leave channel
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    console.log('[MobileProctorService] Disposed');
  }

  /**
   * Register callbacks for UI updates.
   */
  onStatus(callback: (status: MobileProctorStatus) => void): void {
    this.onStatusUpdate = callback;
  }

  onFrame(callback: (frame: RawDetectionFrame) => void): void {
    this.onDetectionFrame = callback;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  // ─── MediaPipe Processing ────────────────────────────────────────────

  private startProcessingLoop(): void {
    const intervalMs = Math.round(1000 / this.targetFps);
    let lastVideoTime = -1;

    this.processingLoop = setInterval(async () => {
      if (this.disposed || !this.videoElement) return;
      if (this.videoElement.videoWidth === 0) return;
      if (this.videoElement.currentTime === lastVideoTime) return;
      lastVideoTime = this.videoElement.currentTime;

      try {
        const landmarker = await mediaPipeService.getLandmarker();
        let startTimeMs = performance.now();

        // Avoid duplicate timestamps
        if (startTimeMs <= (landmarker as any).lastStartTimeMs) {
          startTimeMs = (landmarker as any).lastStartTimeMs + 1;
        }
        (landmarker as any).lastStartTimeMs = startTimeMs;

        const result = landmarker.detectForVideo(this.videoElement, startTimeMs);

        // Build detection frame
        const frame = this.buildDetectionFrame(result);

        // Broadcast to desktop
        this.broadcastMessage('DETECTION_FRAME', {
          frame,
        } as DetectionFramePayload);

        // Notify UI
        this.onDetectionFrame?.(frame);

      } catch (error) {
        console.error('[MobileProctorService] Processing error:', error);
      }
    }, intervalMs);
  }

  private buildDetectionFrame(result: any): RawDetectionFrame {
    const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;
    const hasFace = faceCount > 0;

    let trackingConfidence = 0;
    let gazeDirection: RawDetectionFrame['gazeDirection'] = 'center';
    let isMouthMoving = false;
    let expression = 'Neutral';
    let headPitch = 0, headYaw = 0, headRoll = 0;
    let facePosition: 'CENTERED' | 'PARTIAL_OUT' = 'CENTERED';

    if (hasFace) {
      const landmarks = result.faceLandmarks[0];
      const blendshapes = result.faceBlendshapes?.[0];

      // Bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of landmarks) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }

      const faceCenterX = (minX + maxX) / 2;
      const faceCenterY = (minY + maxY) / 2;
      const faceArea = (maxX - minX) * (maxY - minY);

      if (faceCenterX < 0.20 || faceCenterX > 0.80 || faceCenterY < 0.20 || faceCenterY > 0.80) {
        facePosition = 'PARTIAL_OUT';
      }

      // Simplified head pose
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const nose = landmarks[1];
      const forehead = landmarks[10];
      const chin = landmarks[152];

      const faceW = Math.abs(rightCheek.x - leftCheek.x);
      const faceH = Math.abs(chin.y - forehead.y);

      if (faceW > 0.01) {
        const noseRelX = (nose.x - leftCheek.x) / faceW;
        headYaw = Math.round((0.5 - noseRelX) * 90);
      }
      if (faceH > 0.01) {
        const noseRelY = (nose.y - forehead.y) / faceH;
        headPitch = Math.round((0.5 - noseRelY) * 80);
      }

      // Roll from eye line
      const dx = landmarks[263].x - landmarks[33].x;
      const dy = landmarks[263].y - landmarks[33].y;
      headRoll = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);

      // Confidence
      const faceSizeScore = Math.min(1.0, faceArea / 0.15);
      const distFromCenter = Math.sqrt((faceCenterX - 0.5) ** 2 + (faceCenterY - 0.5) ** 2);
      const centeringScore = Math.max(0, 1.0 - distFromCenter * 2);
      trackingConfidence = Math.round((faceSizeScore * 0.5 + centeringScore * 0.5) * 100);

      // Gaze from blendshapes
      if (blendshapes?.categories?.length > 0) {
        const getCat = (name: string) => blendshapes.categories.find((c: any) => c.categoryName === name)?.score || 0;

        const lookLeft = (getCat('eyeLookOutLeft') + getCat('eyeLookInRight')) / 2;
        const lookRight = (getCat('eyeLookInLeft') + getCat('eyeLookOutRight')) / 2;
        const lookUp = (getCat('eyeLookUpLeft') + getCat('eyeLookUpRight')) / 2;
        const lookDown = (getCat('eyeLookDownLeft') + getCat('eyeLookDownRight')) / 2;

        const horizontal = lookRight - lookLeft;
        const vertical = lookUp - lookDown;
        const THRESHOLD = 0.30;

        if (horizontal > THRESHOLD) gazeDirection = 'right';
        else if (horizontal < -THRESHOLD) gazeDirection = 'left';
        else if (vertical > THRESHOLD) gazeDirection = 'up';
        else if (vertical < -THRESHOLD) gazeDirection = 'down';
        else gazeDirection = 'center';

        // Mouth activity
        const mouthActivity = ['mouthPucker', 'mouthFunnel', 'jawOpen',
          'mouthLowerDownLeft', 'mouthLowerDownRight']
          .reduce((sum, name) => sum + getCat(name), 0);
        isMouthMoving = mouthActivity > 0.45;
        expression = isMouthMoving ? 'Speaking' : 'Neutral';
      }
    }

    return {
      faceCount,
      faceDetected: hasFace,
      landmarkCount: hasFace ? result.faceLandmarks[0].length : 0,
      trackingConfidence,
      gazeDirection,
      isHeadTurned: Math.abs(headYaw) > 25,
      isMouthMoving,
      expression,
      timestamp: Date.now(),
      headPitch: isFinite(headPitch) ? headPitch : 0,
      headYaw: isFinite(headYaw) ? headYaw : 0,
      headRoll: isFinite(headRoll) ? headRoll : 0,
      facePosition,
    };
  }


  // ─── Heartbeat Loop ──────────────────────────────────────────────────

  private startHeartbeatLoop(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.disposed || !this.channel) return;
      this.heartbeatCount++;

      this.broadcastMessage('HEARTBEAT', {
        metrics: {
          fps: this.targetFps,
          lastDetectionAgoMs: 0,
          trackingConfidence: 100,
          gazeDirection: 'center',
          detectionHealth: 'GOOD',
          engineState: 'READY'
        },
        batteryLevel: this.batteryLevel,
        avgInferenceTimeMs: 0,
        reconnectCount: 0
      });

      console.log(`[Phone] HEARTBEAT #${this.heartbeatCount}`);
    }, PHONE_PROCTORING.HEARTBEAT_INTERVAL_MS);
  }

  // ─── Battery Monitoring ──────────────────────────────────────────────

  private async initBattery(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        this.batteryManager = await (navigator as any).getBattery();
        this.batteryLevel = Math.round(this.batteryManager.level * 100);
      }
    } catch {
      console.warn('[MobileProctorService] Battery API unavailable');
    }
  }

  // ─── Message Handling ────────────────────────────────────────────────

  private handleMessage(msg: ProctorMessage): void {
    if (msg.version !== PROCTOR_PROTOCOL_VERSION) return;

    // Handle ACKs
    if (msg.type === 'ACK' && msg.ackSequence !== undefined) {
      const pending = this.pendingAcks.get(msg.ackSequence);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingAcks.delete(msg.ackSequence);
      }
      return;
    }

    // Send ACK for messages that require it
    const ackRequiredTypes: ProctorMessageType[] = ['PHONE_CONNECTED', 'MEDIA_UPLOADED', 'CAPTURE_VIOLATION'];
    if (ackRequiredTypes.includes(msg.type)) {
      this.broadcastMessage('ACK', {}, msg.sequence);
    }

    switch (msg.type) {
      case 'CAPTURE_VIOLATION':
        this.handleCaptureViolation(msg.payload?.violationId);
        break;
      case 'WEBRTC_SIGNAL':
        this.handleWebRTCSignal(msg.payload as WebRTCSignalPayload);
        break;
    }
  }

  private async handleCaptureViolation(violationId: string): Promise<void> {
    if (!violationId || !this.sessionId) return;

    try {
      console.log(`[Phone] Capturing evidence for violation: ${violationId}`);
      let snapshotUrl: string | null = null;
      let clipUrl: string | null = null;

      // Capture snapshot
      if (this.videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.videoElement, 0, 0);
          const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8));
          if (blob && supabase) {
            const path = `session/${this.sessionId}/violation/${violationId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`;
            const { data } = await supabase.storage.from('proctoring-snapshots').upload(path, blob);
            if (data?.path) {
              const { data: urlData } = supabase.storage.from('proctoring-snapshots').getPublicUrl(data.path);
              snapshotUrl = urlData?.publicUrl || null;
            }
          }
        }
      }

      // Capture clip from rolling recorder
      if (this.rollingRecorder) {
        const clipBlob = await this.rollingRecorder.captureClip();
        if (clipBlob && supabase) {
          const path = `session/${this.sessionId}/violation/${violationId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.webm`;
          const { data } = await supabase.storage.from('proctoring-clips').upload(path, clipBlob);
          if (data?.path) {
            const { data: urlData } = supabase.storage.from('proctoring-clips').getPublicUrl(data.path);
            clipUrl = urlData?.publicUrl || null;
          }
        }
      }

      // Notify desktop
      this.broadcastMessage('MEDIA_UPLOADED', {
        violationId,
        snapshotUrl,
        clipUrl,
      } as MediaUploadedPayload);

    } catch (error) {
      console.error('[MobileProctorService] Failed to capture violation media:', error);
    }
  }

  // ─── WebRTC (Phone initiates offer) ──────────────────────────────────

  private async initiateWebRTC(): Promise<void> {
    try {
      console.log('[Phone] Creating WebRTC Offer...');
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Send ICE candidates to desktop
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          this.broadcastMessage('WEBRTC_SIGNAL', {
            signalType: 'ice-candidate',
            data: event.candidate.toJSON(),
          } as WebRTCSignalPayload);
        }
      };

      // Add phone camera video track to the peer connection
      if (this.stream) {
        const videoTrack = this.stream.getVideoTracks()[0];
        if (videoTrack) {
          console.log('[Phone] WebRTC adding video track');
          this.peerConnection.addTrack(videoTrack, this.stream);
        }
      }

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false,
      });
      await this.peerConnection.setLocalDescription(offer);

      // Send offer to desktop via Supabase Broadcast
      this.broadcastMessage('WEBRTC_SIGNAL', {
        signalType: 'offer',
        data: offer,
      } as WebRTCSignalPayload);

      console.log('[Phone] WebRTC Offer sent successfully');
    } catch (error) {
      console.warn('[Phone] WebRTC initiation failed:', error);
    }
  }

  private async handleWebRTCSignal(payload: WebRTCSignalPayload): Promise<void> {
    try {
      if (payload.signalType === 'answer') {
        if (this.peerConnection) {
          console.log('[Phone] WebRTC Answer received');
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(payload.data)
          );
        }
      } else if (payload.signalType === 'ice-candidate' && payload.data) {
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(payload.data)
          );
        }
      }
    } catch (error) {
      console.warn('[Phone] WebRTC signal error:', error);
    }
  }

  // ─── Broadcasting ────────────────────────────────────────────────────

  private broadcastMessage(type: ProctorMessageType, payload: any, ackSequence?: number): void {
    if (!this.channel || this.disposed) return;

    this.phoneSequence++;
    const message: ProctorMessage = {
      version: PROCTOR_PROTOCOL_VERSION,
      type,
      timestamp: Date.now(),
      sequence: this.phoneSequence,
      payload,
      ...(ackSequence !== undefined ? { ackSequence } : {}),
    };

    this.channel.send({
      type: 'broadcast',
      event: 'proctor_message',
      payload: message,
    });

    // ACK tracking for critical messages
    const ackRequiredTypes: ProctorMessageType[] = ['PHONE_CONNECTED', 'MEDIA_UPLOADED', 'CAPTURE_VIOLATION'];
    if (ackRequiredTypes.includes(type)) {
      this.setupAckRetry(message);
    }
  }

  private setupAckRetry(message: ProctorMessage): void {
    const retry = () => {
      const pending = this.pendingAcks.get(message.sequence);
      if (!pending || this.disposed) return;

      const ACK_MAX_RETRIES = 3;
      const ACK_TIMEOUT_MS = 3000;

      if (pending.retries >= ACK_MAX_RETRIES) {
        console.warn(`[Phone] ACK timeout for ${message.type} seq=${message.sequence}`);
        this.pendingAcks.delete(message.sequence);
        return;
      }

      pending.retries++;
      this.channel?.send({
        type: 'broadcast',
        event: 'proctor_message',
        payload: message,
      });
      pending.timer = setTimeout(retry, ACK_TIMEOUT_MS);
    };

    const ACK_TIMEOUT_MS = 3000;
    this.pendingAcks.set(message.sequence, {
      retries: 0,
      timer: setTimeout(retry, ACK_TIMEOUT_MS),
      message,
    });
  }

  // ─── Status Updates ──────────────────────────────────────────────────

  private emitStatusUpdate(): void {
    this.onStatusUpdate?.({
      connected: true,
      battery: this.batteryLevel,
      thermal: 'normal',
      fps: this.targetFps,
      connectionId: this.connectionId,
    });
  }
}

export interface MobileProctorStatus {
  connected: boolean;
  battery: number | null;
  thermal: 'normal' | 'warm' | 'hot';
  fps: number;
  connectionId: string;
}
