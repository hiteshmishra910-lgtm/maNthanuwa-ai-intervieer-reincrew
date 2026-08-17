import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { mediaPipeService } from '../services/mediaPipeService';
import { RawDetectionFrame, HeartbeatMetrics } from '../../../types';

interface CameraAnalysisProps {
  stream: MediaStream | null;
  onDetectionFrame: (frame: RawDetectionFrame) => void;
  onHeartbeat: (metrics: HeartbeatMetrics) => void;
  onEngineReady: () => void;
  enabled: boolean;
  fpsTarget?: number;           // 3 for mobile, 30 for desktop
  devOverlay?: boolean;
}

/**
 * CameraAnalysis — Headless MediaPipe face analysis engine.
 * 
 * Runs face landmarker detection on a MediaStream and emits structured
 * detection frames and heartbeat metrics via callbacks. No visible rendering
 * in production mode. Creates a hidden video element internally to feed
 * MediaPipe.
 * 
 * Extracted from CameraMonitor.tsx to separate AI concerns from rendering.
 */
export const CameraAnalysis: React.FC<CameraAnalysisProps> = ({
  stream,
  onDetectionFrame,
  onHeartbeat,
  onEngineReady,
  enabled,
  fpsTarget = 30,
  devOverlay = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const [engineLoaded, setEngineLoaded] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const isComponentMountedRef = useRef<boolean>(true);
  const lastProcessTimeRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastHeartbeatTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const smoothedFpsRef = useRef<number>(fpsTarget);

  // Head pose tracking for smoothing and baseline calibration
  const lastPitchRef = useRef<number>(0);
  const lastYawRef = useRef<number>(0);
  const lastRollRef = useRef<number>(0);
  const baselinePitchRef = useRef<number | null>(null);
  const baselineYawRef = useRef<number | null>(null);
  const baselineRollRef = useRef<number | null>(null);
  const faceTrackingStartTimeRef = useRef<number | null>(null);
  const faceLostTimeRef = useRef<number | null>(null);

  const lastConfidenceRef = useRef<number>(100);
  const lastGazeDirectionRef = useRef<string>('center');
  const lastDetectionHealthRef = useRef<'GOOD' | 'LOW_LIGHT' | 'PARTIAL_FACE' | 'UNSTABLE'>('GOOD');

  const SMOOTHING = 0.8;
  const MIN_FACE_AREA = 0.03;
  const FRAME_PROCESS_INTERVAL = Math.round(1000 / fpsTarget);
  const HEARTBEAT_INTERVAL = 500;

  // Initialize MediaPipe engine
  useEffect(() => {
    let isActive = true;
    isComponentMountedRef.current = true;

    const initEngine = async () => {
      try {
        const landmarker = await mediaPipeService.getLandmarker();
        if (isActive) {
          faceLandmarkerRef.current = landmarker;
          setEngineLoaded(true);
          onEngineReady();
        }
      } catch (error) {
        console.error('[CameraAnalysis] Failed to init MediaPipe:', error);
      }
    };

    initEngine();

    return () => {
      isActive = false;
      isComponentMountedRef.current = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Wire stream to hidden video element and start processing loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !faceLandmarkerRef.current) return;

    video.srcObject = stream;

    const tryPlay = async () => {
      try {
        await video.play();
      } catch (e) {
        console.warn('[CameraAnalysis] Auto-play prevented:', e);
        // iOS sometimes needs a user gesture — retry after short delay
        setTimeout(() => video.play().catch(() => {}), 1000);
      }
    };

    tryPlay();

    const startProcessing = () => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        predictWebcam();
      } else {
        const onReady = () => {
          if (video.videoWidth > 0) {
            predictWebcam();
          } else {
            // Wait for actual dimensions on mobile
            const checkDimensions = setInterval(() => {
              if (video.videoWidth > 0) {
                clearInterval(checkDimensions);
                predictWebcam();
              }
            }, 100);
            setTimeout(() => clearInterval(checkDimensions), 5000);
          }
        };
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('canplay', onReady, { once: true });
      }
    };

    startProcessing();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [stream, enabled, engineLoaded]);

  const predictWebcam = () => {
    if (!isComponentMountedRef.current || !enabled) return;
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker) return;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
      return;
    }

    try {
      const now = performance.now();
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        if (now - lastProcessTimeRef.current >= FRAME_PROCESS_INTERVAL) {
          lastProcessTimeRef.current = now;
          frameCountRef.current++;

          let startTimeMs = performance.now();
          if (startTimeMs <= (landmarker as any).lastStartTimeMs) {
            startTimeMs = (landmarker as any).lastStartTimeMs + 1;
          }
          (landmarker as any).lastStartTimeMs = startTimeMs;

          const result = landmarker.detectForVideo(video, startTimeMs);
          processResult(result);
        }
      }

      // Heartbeat emission
      if (now - lastHeartbeatTimeRef.current >= HEARTBEAT_INTERVAL) {
        const instantaneousFps = (frameCountRef.current * 1000) / (now - lastHeartbeatTimeRef.current);
        smoothedFpsRef.current = (smoothedFpsRef.current * 0.7) + (instantaneousFps * 0.3);
        const fps = Math.round(smoothedFpsRef.current);
        frameCountRef.current = 0;

        onHeartbeat({
          fps,
          lastDetectionAgoMs: now - lastProcessTimeRef.current,
          trackingConfidence: lastConfidenceRef.current,
          gazeDirection: lastGazeDirectionRef.current,
          detectionHealth: lastDetectionHealthRef.current,
          engineState: 'READY',
        });
        lastHeartbeatTimeRef.current = now;
      }
    } catch (err) {
      console.error('[CameraAnalysis] Error in predictWebcam loop:', err);
    } finally {
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  const processResult = (result: any) => {
    let validFaceLandmarks: any[] = [];
    if (result.faceLandmarks && Array.isArray(result.faceLandmarks)) {
      validFaceLandmarks = result.faceLandmarks.filter((landmarks: any[]) => {
        if (!landmarks || landmarks.length === 0) return false;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        landmarks.forEach((pt: any) => {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        });
        const area = (maxX - minX) * (maxY - minY);
        return area >= 0.025; // Filter tiny background reflection noise or artifacts (< 2.5% of frame area)
      });
    }

    const faceCount = validFaceLandmarks.length;
    const hasFace = faceCount > 0;

    let trackingConfidence = 0;
    let gazeDirection: RawDetectionFrame['gazeDirection'] = 'center';
    const isHeadTurned = false;
    let isMouthMoving = false;
    let expression = 'Neutral';
    let headPitch = 0;
    let headYaw = 0;
    let headRoll = 0;
    let facePosition: 'CENTERED' | 'PARTIAL_OUT' = 'CENTERED';

    if (hasFace) {
      const landmarks = validFaceLandmarks[0];
      const blendshapes = result.faceBlendshapes ? result.faceBlendshapes[0] : null;

      // Bounding Box and Face Position
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      landmarks.forEach((pt: any) => {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      });

      const faceWidth = maxX - minX;
      const faceHeight = maxY - minY;
      const faceCenterX = (minX + maxX) / 2;
      const faceCenterY = (minY + maxY) / 2;
      const faceArea = faceWidth * faceHeight;

      if (faceCenterX < 0.20 || faceCenterX > 0.80 || faceCenterY < 0.20 || faceCenterY > 0.80) {
        facePosition = 'PARTIAL_OUT';
      }

      // Head Pose Estimation
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const nose = landmarks[1];
      const forehead = landmarks[10];
      const chin = landmarks[152];

      const internalFaceWidth = Math.abs(rightCheek.x - leftCheek.x);
      const internalFaceHeight = Math.abs(chin.y - forehead.y);

      let rawYaw = 0;
      let rawPitch = 0;
      if (internalFaceWidth > 0.01) {
        const noseRelX = (nose.x - leftCheek.x) / internalFaceWidth;
        rawYaw = (0.5 - noseRelX) * 90;
      }
      if (internalFaceHeight > 0.01) {
        const noseRelY = (nose.y - forehead.y) / internalFaceHeight;
        rawPitch = (0.5 - noseRelY) * 80;
      }

      const dx = landmarks[263].x - landmarks[33].x;
      const dy = landmarks[263].y - landmarks[33].y;
      let rawRoll = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (rawRoll > 90) rawRoll -= 180;
      if (rawRoll < -90) rawRoll += 180;

      if (!isFinite(rawYaw)) rawYaw = 0;
      if (!isFinite(rawPitch)) rawPitch = 0;
      if (!isFinite(rawRoll)) rawRoll = 0;

      // Exponential Smoothing
      headPitch = lastPitchRef.current * SMOOTHING + rawPitch * (1 - SMOOTHING);
      headYaw = lastYawRef.current * SMOOTHING + rawYaw * (1 - SMOOTHING);
      headRoll = lastRollRef.current * SMOOTHING + rawRoll * (1 - SMOOTHING);

      lastPitchRef.current = headPitch;
      lastYawRef.current = headYaw;
      lastRollRef.current = headRoll;

      // Baseline Calibration
      const now = Date.now();
      if (!faceTrackingStartTimeRef.current) {
        if (faceLostTimeRef.current && (now - faceLostTimeRef.current < 5000)) {
          // Preserved baseline
        } else {
          baselinePitchRef.current = null;
          baselineYawRef.current = null;
          baselineRollRef.current = null;
        }
        faceTrackingStartTimeRef.current = now;
      }
      faceLostTimeRef.current = null;

      if (faceTrackingStartTimeRef.current && now - faceTrackingStartTimeRef.current > 2000 && now - faceTrackingStartTimeRef.current < 3000) {
        if (baselinePitchRef.current === null && Math.abs(rawYaw) < 15 && Math.abs(rawPitch) < 15) {
          baselinePitchRef.current = headPitch;
          baselineYawRef.current = headYaw;
          baselineRollRef.current = headRoll;
        }
      }

      let calibPitch = headPitch;
      let calibYaw = headYaw;
      let calibRoll = headRoll;

      if (baselinePitchRef.current !== null) {
        calibPitch -= baselinePitchRef.current;
        calibYaw -= baselineYawRef.current!;
        calibRoll -= baselineRollRef.current!;
      }

      headPitch = Math.round(calibPitch);
      headYaw = Math.round(calibYaw);
      headRoll = Math.round(calibRoll);

      // Tracking Confidence
      const jitterMagnitude = (Math.abs(rawYaw - lastYawRef.current) / 90 + Math.abs(rawPitch - lastPitchRef.current) / 80) / 2;
      const trackingStabilityScore = Math.max(0, 1.0 - jitterMagnitude * 2);
      const faceSizeScore = Math.min(1.0, faceArea / 0.15);
      const distFromCenter = Math.sqrt(Math.pow(faceCenterX - 0.5, 2) + Math.pow(faceCenterY - 0.5, 2));
      const centeringScore = Math.max(0, 1.0 - distFromCenter * 2);

      trackingConfidence = (faceSizeScore * 0.40 + centeringScore * 0.30 + trackingStabilityScore * 0.30) * 100;
      if (faceArea < MIN_FACE_AREA) trackingConfidence *= 0.5;
      trackingConfidence = Math.max(0, Math.min(100, trackingConfidence));

      // Gaze Tracking with Hysteresis
      if (blendshapes && blendshapes.categories && blendshapes.categories.length > 0) {
        const getCat = (name: string) => blendshapes.categories.find((c: any) => c.categoryName === name)?.score || 0;

        const userLookingLeft = (getCat('eyeLookOutLeft') + getCat('eyeLookInRight')) / 2;
        const userLookingRight = (getCat('eyeLookInLeft') + getCat('eyeLookOutRight')) / 2;
        const userLookingUp = (getCat('eyeLookUpLeft') + getCat('eyeLookUpRight')) / 2;
        const userLookingDown = (getCat('eyeLookDownLeft') + getCat('eyeLookDownRight')) / 2;

        const horizontal = userLookingRight - userLookingLeft;
        const vertical = userLookingUp - userLookingDown;

        const ENTER = 0.30;
        const EXIT = 0.20;
        const currentGaze = lastGazeDirectionRef.current;
        let newGaze: RawDetectionFrame['gazeDirection'] = currentGaze as any;

        if (horizontal > ENTER) newGaze = 'right';
        else if (horizontal < -ENTER) newGaze = 'left';
        else if (vertical > ENTER) newGaze = 'up';
        else if (vertical < -ENTER) newGaze = 'down';
        else if (Math.abs(horizontal) < EXIT && Math.abs(vertical) < EXIT) newGaze = 'center';

        gazeDirection = newGaze;

        // Mouth activity
        const mouthActivity = blendshapes.categories.filter((b: any) =>
          ['mouthPucker', 'mouthFunnel', 'mouthLowerDownLeft', 'mouthLowerDownRight',
           'mouthUpperUpLeft', 'mouthUpperUpRight', 'jawOpen'].includes(b.categoryName)
        ).reduce((sum: number, b: any) => sum + b.score, 0);

        isMouthMoving = mouthActivity > 0.45;
        const smile = getCat('mouthSmileLeft');
        expression = isMouthMoving ? 'Speaking' : (smile > 0.4 ? 'Smiling' : 'Neutral');
      }

    } else {
      // No face detected
      faceTrackingStartTimeRef.current = null;
      if (!faceLostTimeRef.current) {
        faceLostTimeRef.current = Date.now();
      }
    }

    if (!isFinite(headPitch)) headPitch = 0;
    if (!isFinite(headYaw)) headYaw = 0;
    if (!isFinite(headRoll)) headRoll = 0;
    if (!isFinite(trackingConfidence)) trackingConfidence = 0;

    lastConfidenceRef.current = trackingConfidence;
    lastGazeDirectionRef.current = gazeDirection;

    let detectionHealth: 'GOOD' | 'LOW_LIGHT' | 'PARTIAL_FACE' | 'UNSTABLE' = 'GOOD';
    if (!hasFace) detectionHealth = 'UNSTABLE';
    else if (facePosition === 'PARTIAL_OUT') detectionHealth = 'PARTIAL_FACE';
    else if (trackingConfidence < 60) detectionHealth = 'UNSTABLE';
    lastDetectionHealthRef.current = detectionHealth;

    const frameData: RawDetectionFrame = {
      faceCount,
      faceDetected: hasFace,
      landmarkCount: hasFace && result.faceLandmarks[0] ? result.faceLandmarks[0].length : 0,
      trackingConfidence: Math.round(trackingConfidence),
      gazeDirection,
      isHeadTurned,
      isMouthMoving,
      expression,
      timestamp: Date.now(),
      headPitch,
      headYaw,
      headRoll,
      facePosition,
    };

    onDetectionFrame(frameData);
  };

  // Hidden video element — feeds MediaPipe, not visible to user
  return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        x5-playsinline="true"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
  );
};
