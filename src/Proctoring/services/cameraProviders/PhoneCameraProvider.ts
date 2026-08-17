import { supabase } from '../../../Core/database/supabaseClient';
import { SupabaseService } from '../../../Core/database/supabaseService';
import {
  CameraProvider,
  CameraProviderListener,
  CameraProviderStatus,
  CameraProviderError,
  PhoneConnectionState,
  ProctorMessage,
  ProctorMessageType,
  PhoneConnectedPayload,
  DetectionFramePayload,
  HeartbeatPayload,
  MediaUploadedPayload,
  WebRTCSignalPayload,
  PROCTOR_PROTOCOL_VERSION,
  PHONE_PROCTORING,
  RawDetectionFrame,
  HeartbeatMetrics,
  ProctoringConfiguration,
} from '../../../../types';

/** Messages that require ACK from the receiver */
const ACK_REQUIRED_TYPES: ProctorMessageType[] = [
  'PHONE_CONNECTED',
  'MEDIA_UPLOADED',
  'CAPTURE_VIOLATION',
];

const ACK_TIMEOUT_MS = 3000;
const ACK_MAX_RETRIES = 3;

/**
 * PhoneCameraProvider — CameraProvider implementation for the phone camera path.
 * Runs on the **desktop** side.
 *
 * Responsibilities:
 * - Generates pairing token and displays QR code data.
 * - Listens for phone connection via Supabase Realtime.
 * - Establishes WebRTC peer connection for live video preview.
 * - Receives detection frames and heartbeats from phone via Realtime.
 * - Enforces session ownership via connectionId (not fingerprinting).
 * - Tracks network quality, sequence ordering, and time sync offset.
 */
export class PhoneCameraProvider implements CameraProvider {
  readonly type = 'phone_camera' as const;

  private sessionId: string;
  private listeners: CameraProviderListener[] = [];
  private disposed = false;

  // Pairing
  private pairingToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  // Connection
  private connectionState: PhoneConnectionState = 'WAITING';
  private connectionId: string | null = null;
  private reconnectCount = 0;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Heartbeat Watchdog
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private lastHeartbeatTime = 0;

  // Realtime
  private channel: any = null;
  private desktopSequence = 0;
  private lastReceivedSequence = 0;

  // WebRTC
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;

  // Network Quality
  private latencySamples: number[] = [];
  private receivedCount = 0;

  // Status
  private status: CameraProviderStatus = {
    connected: false,
    fps: 0,
    thermal: 'normal',
    battery: undefined,
    latencyMs: undefined,
  };

  // ACK tracking
  private pendingAcks = new Map<number, {
    retries: number;
    timer: ReturnType<typeof setTimeout>;
    message: ProctorMessage;
  }>();

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Generate pairing token, join Realtime channel, and wait for phone.
   * Does NOT block until phone connects — the caller renders the QR code
   * and the phone connects asynchronously.
   */
  async initialize(config?: ProctoringConfiguration): Promise<void> {
    if (!supabase) throw new Error('Supabase not initialized');

    // Generate token (valid for TOKEN_EXPIRY_MINUTES)
    this.pairingToken = await SupabaseService.generatePairingToken(this.sessionId);
    this.tokenExpiresAt = new Date(Date.now() + PHONE_PROCTORING.TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Join realtime channel
    this.channel = supabase.channel(`proctoring:${this.sessionId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel.on('broadcast', { event: 'proctor_message' }, (payload: any) => {
      if (this.disposed) return;
      this.handleMessage(payload.payload as ProctorMessage);
    });

    await this.channel.subscribe();

    // Start heartbeat watchdog
    this.startWatchdog();

    this.setConnectionState('WAITING');
    console.log(`[Desktop] WAITING for phone. Token: ${this.pairingToken}`);
  }

  // ─── CameraProvider Interface ────────────────────────────────────────

  start(): void {
    if (this.connectionState === 'CONNECTED') {
      // Interview begins — state stays CONNECTED, watchdog continues
    }
  }

  stop(): void {
    // Pause — don't disconnect
  }

  getPreviewStream(): MediaStream | null {
    return this.remoteStream;
  }

  getStatus(): CameraProviderStatus {
    return { ...this.status };
  }

  subscribe(listener: CameraProviderListener): void {
    this.listeners.push(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // 1. Stop watchdog
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    // 2. Clear disconnect grace timer
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    // 3. Clear all pending ACK timers
    this.pendingAcks.forEach(({ timer }) => clearTimeout(timer));
    this.pendingAcks.clear();

    // 4. Close WebRTC peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // 5. Stop all remote media tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(t => t.stop());
      this.remoteStream = null;
    }

    // 6. Unsubscribe and destroy Supabase Broadcast channel
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }

    this.listeners = [];
    this.status = { connected: false, fps: 0, thermal: 'normal' };
    console.log('[Desktop] PhoneCameraProvider disposed. All resources cleaned up.');
  }

  // ─── Public Accessors ────────────────────────────────────────────────

  getPairingToken(): string | null {
    return this.pairingToken;
  }

  getTokenExpiresAt(): Date | null {
    return this.tokenExpiresAt;
  }

  getConnectionState(): PhoneConnectionState {
    return this.connectionState;
  }


  // ─── Message Handling ────────────────────────────────────────────────

  private handleMessage(msg: ProctorMessage): void {
    // Version check
    if (msg.version !== PROCTOR_PROTOCOL_VERSION) {
      console.warn(`[PhoneCameraProvider] Ignoring message with version ${msg.version} (expected ${PROCTOR_PROTOCOL_VERSION})`);
      return;
    }

    // Handle ACK responses
    if (msg.type === 'ACK' && msg.ackSequence !== undefined) {
      this.handleAck(msg.ackSequence);
      return;
    }

    // Sequence filtering (skip out-of-order messages, except for connection events)
    const isConnectionEvent = msg.type === 'PHONE_CONNECTED' || msg.type === 'PHONE_DISCONNECTED';
    if (!isConnectionEvent && msg.sequence <= this.lastReceivedSequence) {
      console.debug(`[PhoneCameraProvider] Dropping out-of-order message seq=${msg.sequence} (last=${this.lastReceivedSequence})`);
      return;
    }
    if (!isConnectionEvent) {
      this.lastReceivedSequence = msg.sequence;
      this.receivedCount++;
    }

    // Send ACK for messages that require it
    if (ACK_REQUIRED_TYPES.includes(msg.type)) {
      this.sendAck(msg.sequence);
    }

    // Dispatch by type
    switch (msg.type) {
      case 'PHONE_CONNECTED':
        this.handlePhoneConnected(msg.payload as PhoneConnectedPayload);
        break;
      case 'PHONE_DISCONNECTED':
        this.handlePhoneDisconnected();
        break;
      case 'DETECTION_FRAME':
        this.handleDetectionFrame(msg);
        break;
      case 'HEARTBEAT':
        this.handleHeartbeat(msg);
        break;
      case 'MEDIA_UPLOADED':
        this.handleMediaUploaded(msg.payload as MediaUploadedPayload);
        break;
      case 'WEBRTC_SIGNAL':
        this.handleWebRTCSignal(msg.payload as WebRTCSignalPayload);
        break;
      default:
        console.debug(`[Desktop] Unhandled message type: ${msg.type}`);
    }
  }

  private handlePhoneConnected(payload: PhoneConnectedPayload): void {
    const { connectionId, batteryLevel } = payload;

    // Session ownership check: if a different device tries to claim this session, reject it
    if (this.connectionId && this.connectionId !== connectionId) {
      console.warn(`[Desktop] Rejecting connection from ${connectionId} — session owned by ${this.connectionId}`);
      this.listeners.forEach(l => l.onError({ code: 'PHONE_DISCONNECTED', canReconnect: false }));
      return;
    }

    // Clear any pending disconnect grace/watchdog escalation timer
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (this.connectionId === connectionId) {
      // Same device reconnecting after a drop
      this.reconnectCount++;
      console.log(`[Desktop] RECONNECTED (connectionId: ${connectionId}, reconnects: ${this.reconnectCount})`);
    } else {
      // First-ever connection for this session
      this.connectionId = connectionId;
      console.log(`[Desktop] CONNECTED (connectionId: ${connectionId})`);
    }

    // Reset watchdog timestamp so we don't immediately re-enter RECONNECTING
    this.lastHeartbeatTime = Date.now();

    this.status = {
      ...this.status,
      connected: true,
      battery: batteryLevel ?? undefined,
    };
    this.setConnectionState('CONNECTED');
    this.listeners.forEach(l => l.onStatusChange(this.status));
  }

  private handlePhoneDisconnected(): void {
    console.warn('[Desktop] PHONE_DISCONNECTED signal received. Watchdog will escalate if no reconnect.');
    this.setConnectionState('RECONNECTING');
    this.status = { ...this.status, connected: false };
    this.listeners.forEach(l => l.onStatusChange(this.status));
    // Watchdog takes care of escalating to FAILED after DISCONNECT_TIMEOUT_MS
  }

  private handleDetectionFrame(msg: ProctorMessage): void {
    const payload = msg.payload as DetectionFramePayload;
    this.listeners.forEach(l => l.onDetectionFrame(payload.frame));
    this.updateLatency(msg.timestamp);
  }

  private handleHeartbeat(msg: ProctorMessage): void {
    const payload = msg.payload as HeartbeatPayload;
    const wasReconnecting = this.connectionState === 'RECONNECTING';

    this.lastHeartbeatTime = Date.now();
    console.log(`[Desktop] HEARTBEAT RECEIVED (seq ${msg.sequence})`);

    // If we were RECONNECTING and a heartbeat arrives, phone is back
    if (wasReconnecting) {
      console.log('[Desktop] RECONNECTED (heartbeat restored)');
      this.setConnectionState('CONNECTED');
      this.status = { ...this.status, connected: true };
    }

    this.status = {
      ...this.status,
      fps: payload.metrics.fps,
      battery: payload.batteryLevel ?? this.status.battery,
    };

    this.listeners.forEach(l => l.onHeartbeat(payload.metrics));
    this.listeners.forEach(l => l.onStatusChange(this.status));
    this.updateLatency(msg.timestamp);
  }

  private handleMediaUploaded(payload: MediaUploadedPayload): void {
    console.log(`[PhoneCameraProvider] Media uploaded for violation ${payload.violationId}`);
    this.listeners.forEach(l => l.onMediaUploaded?.(payload.violationId, payload.snapshotUrl, payload.clipUrl));
  }

  // ─── Heartbeat Watchdog ───────────────────────────────────────────────
  // Ticks every second to check how long it has been since the last heartbeat.
  // 9s with no heartbeat  → RECONNECTING (UI shows recovery overlay).
  // 20s with no heartbeat → FAILED       (permanent CAMERA_LOST violation).

  private startWatchdog(): void {
    if (this.watchdogInterval) return;
    this.watchdogInterval = setInterval(() => {
      if (this.disposed) return;
      // Only watch when connected or reconnecting
      if (this.connectionState !== 'CONNECTED' && this.connectionState !== 'RECONNECTING') return;
      if (this.lastHeartbeatTime === 0) return;

      const silenceMs = Date.now() - this.lastHeartbeatTime;

      if (silenceMs >= PHONE_PROCTORING.DISCONNECT_TIMEOUT_MS) {
        // connectionState is CONNECTED or RECONNECTING here (guarded above)
        console.error(`[Desktop] ENTER FAILED — no heartbeat for ${silenceMs}ms`);
        this.setConnectionState('FAILED');
        this.status = { ...this.status, connected: false };
        this.listeners.forEach(l => l.onStatusChange(this.status));
        this.listeners.forEach(l => l.onError({ code: 'CAMERA_LOST', reason: 'Phone heartbeat timed out' }));
      } else if (silenceMs >= PHONE_PROCTORING.RECONNECT_TIMEOUT_MS) {
        if (this.connectionState !== 'RECONNECTING') {
          console.warn(`[Desktop] ENTER RECONNECTING — no heartbeat for ${silenceMs}ms`);
          this.setConnectionState('RECONNECTING');
          this.status = { ...this.status, connected: false };
          this.listeners.forEach(l => l.onStatusChange(this.status));
        }
      }
    }, 1000);
  }

  // ─── WebRTC (Desktop is Answerer — Phone initiates Offer) ────────────

  private async handleWebRTCSignal(payload: WebRTCSignalPayload): Promise<void> {
    try {
      if (payload.signalType === 'offer') {
        // Phone has sent an offer — desktop creates RTCPeerConnection and answers
        console.log('[Desktop] WebRTC Offer received from phone. Creating answer...');
        this.peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        // Receive remote video track from phone
        this.peerConnection.ontrack = (event) => {
          console.log('[Desktop] WebRTC remote video track received');
          this.remoteStream = event.streams[0] || new MediaStream([event.track]);
          this.listeners.forEach(l => l.onStatusChange(this.status));
        };

        // Send ICE candidates to phone via Supabase Broadcast
        this.peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            this.broadcastMessage('WEBRTC_SIGNAL', {
              signalType: 'ice-candidate',
              data: event.candidate.toJSON(),
            } as WebRTCSignalPayload);
          }
        };

        this.peerConnection.onconnectionstatechange = () => {
          const state = this.peerConnection?.connectionState;
          console.log(`[Desktop] WebRTC state: ${state}`);
          if (state === 'failed' || state === 'disconnected') {
            console.warn('[Desktop] WebRTC failed — preview unavailable. Proctoring continues via Realtime.');
            this.remoteStream = null;
            this.listeners.forEach(l => l.onStatusChange(this.status));
          }
        };

        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(payload.data)
        );

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.broadcastMessage('WEBRTC_SIGNAL', {
          signalType: 'answer',
          data: answer,
        } as WebRTCSignalPayload);

        console.log('[Desktop] WebRTC Answer sent to phone');

      } else if (payload.signalType === 'ice-candidate' && payload.data) {
        if (this.peerConnection) {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(payload.data)
          );
        }
      }
    } catch (error) {
      console.warn('[Desktop] WebRTC signal error:', error);
      // Not critical — proctoring events still flow via Supabase Realtime
    }
  }

  // ─── Network Quality ─────────────────────────────────────────────────
  // Simple latency: arrivalTime - senderTimestamp (no clock drift correction needed for MVP).

  private updateLatency(messageTimestamp: number): void {
    const latency = Date.now() - messageTimestamp;
    if (latency > 0 && latency < 30000) {
      this.latencySamples.push(latency);
      if (this.latencySamples.length > 20) this.latencySamples.shift();
    }
    const avgLatency = this.latencySamples.length > 0
      ? this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
      : 0;
    this.status = { ...this.status, latencyMs: Math.round(avgLatency) };
  }

  // ─── ACK System ──────────────────────────────────────────────────────

  private sendAck(sequence: number): void {
    this.broadcastMessage('ACK', {}, sequence);
  }

  private handleAck(ackSequence: number): void {
    const pending = this.pendingAcks.get(ackSequence);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingAcks.delete(ackSequence);
    }
  }

  // ─── Broadcasting ────────────────────────────────────────────────────

  private broadcastMessage(
    type: ProctorMessageType,
    payload: any,
    ackSequence?: number
  ): void {
    if (!this.channel || this.disposed) return;

    this.desktopSequence++;
    const message: ProctorMessage = {
      version: PROCTOR_PROTOCOL_VERSION,
      type,
      timestamp: Date.now(),
      sequence: this.desktopSequence,
      payload,
      ...(ackSequence !== undefined ? { ackSequence } : {}),
    };

    this.channel.send({
      type: 'broadcast',
      event: 'proctor_message',
      payload: message,
    });

    // Set up ACK tracking for messages that require it
    if (ACK_REQUIRED_TYPES.includes(type)) {
      this.setupAckRetry(message);
    }
  }

  private setupAckRetry(message: ProctorMessage): void {
    const retry = () => {
      const pending = this.pendingAcks.get(message.sequence);
      if (!pending || this.disposed) return;

      if (pending.retries >= ACK_MAX_RETRIES) {
        console.warn(`[PhoneCameraProvider] ACK timeout for ${message.type} seq=${message.sequence} after ${ACK_MAX_RETRIES} retries`);
        this.pendingAcks.delete(message.sequence);
        return;
      }

      pending.retries++;
      console.debug(`[PhoneCameraProvider] Retrying ${message.type} seq=${message.sequence} (attempt ${pending.retries})`);

      this.channel?.send({
        type: 'broadcast',
        event: 'proctor_message',
        payload: message,
      });

      pending.timer = setTimeout(retry, ACK_TIMEOUT_MS);
    };

    this.pendingAcks.set(message.sequence, {
      retries: 0,
      timer: setTimeout(retry, ACK_TIMEOUT_MS),
      message,
    });
  }

  // ─── Connection State ────────────────────────────────────────────────

  private setConnectionState(state: PhoneConnectionState): void {
    this.connectionState = state;
    console.log(`[Desktop] State → ${state}`);
  }

  /**
   * Send a capture violation request to the phone.
   * The phone will capture snapshot + clip, upload, and respond with MEDIA_UPLOADED.
   */
  requestViolationCapture(violationId: string): void {
    this.broadcastMessage('CAPTURE_VIOLATION', { violationId });
  }
}
