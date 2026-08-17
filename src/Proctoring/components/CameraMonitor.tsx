import React, { useEffect, useRef, useState } from 'react';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { Camera } from 'lucide-react';
import { mediaPipeService } from '../services/mediaPipeService';
import { RawDetectionFrame, HeartbeatMetrics } from '../../../types';

interface CameraMonitorProps {
  mediaStream?: MediaStream; // Optional, if provided, use it instead of requesting
  onDetectionFrame?: (frame: RawDetectionFrame) => void;
  onEngineReady?: () => void;
  onHeartbeat?: (metrics: HeartbeatMetrics) => void;
  devOverlay?: boolean;
  
  // Props forwarded for optional external control
  onWarning?: (count: number, type?: any, msg?: string) => void;
  isLocked?: boolean;
  onVideoReady?: (video: HTMLVideoElement) => void;
}

export const CameraMonitor: React.FC<CameraMonitorProps> = ({ 
  mediaStream,
  onDetectionFrame,
  onEngineReady,
  onHeartbeat,
  devOverlay = import.meta.env.DEV, // Default to true in dev
  
  onWarning,
  isLocked = false,
  onVideoReady
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("Initializing optics...");

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(-1);
  const lastHeartbeatTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const smoothedFpsRef = useRef<number>(30);

  const lastConfidenceRef = useRef<number>(100);
  const lastGazeDirectionRef = useRef<string>('center');
  const lastDetectionHealthRef = useRef<'GOOD' | 'LOW_LIGHT' | 'PARTIAL_FACE' | 'UNSTABLE'>('GOOD');

  const lastPitchRef = useRef<number>(0);
  const lastYawRef = useRef<number>(0);
  const lastRollRef = useRef<number>(0);

  const baselinePitchRef = useRef<number | null>(null);
  const baselineYawRef = useRef<number | null>(null);
  const baselineRollRef = useRef<number | null>(null);
  const faceTrackingStartTimeRef = useRef<number | null>(null);
  const faceLostTimeRef = useRef<number | null>(null);

  const SMOOTHING = 0.8;
  const MIN_FACE_AREA = 0.03;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const FRAME_PROCESS_INTERVAL = isMobile ? 333 : 32; // ~3fps on mobile, ~30fps on desktop
  const HEARTBEAT_INTERVAL = 500;
  const animationFrameIdRef = useRef<number | null>(null);
  const isComponentMountedRef = useRef<boolean>(true);
  const lastVideoTimeRef = useRef<number>(-1);

  useEffect(() => {
    let isActive = true;
    isComponentMountedRef.current = true;

    const initMediaPipe = async () => {
      try {
        setFeedbackMsg("Connecting to AI vision engine...");
        const landmarker = await mediaPipeService.getLandmarker();
        
        if (isActive) {
          faceLandmarkerRef.current = landmarker;
          setIsInitialized(true);
          onEngineReady?.();
          setupCamera();
        }
      } catch (error) {
        console.error("[CameraMonitor] Failed to init MediaPipe:", error);
        if (isActive) {
          setFeedbackMsg("Vision Engine Error.");
        }
      }
    };

    const setupCamera = async () => {
      if (!videoRef.current) return;

      if (mediaStream) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => console.warn("Auto-play prevented", e));
        if (videoRef.current.readyState >= 2) {
          predictWebcam();
          onVideoReady?.(videoRef.current);
        } else {
          videoRef.current.onloadeddata = () => {
            predictWebcam();
            onVideoReady?.(videoRef.current!);
          };
        }
      } else {
        try {
          // If we already requested it, use the active stream
          if (videoRef.current.srcObject) {
             videoRef.current.play().catch(e => console.warn("Auto-play prevented", e));
             if (videoRef.current.readyState >= 2) {
               predictWebcam();
             } else {
               videoRef.current.onloadeddata = () => predictWebcam();
             }
             return;
          }
          
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, frameRate: { ideal: 30 } }
          });
          
          if (!isActive) {
            // Wait! In React Strict Mode, we might unmount/remount instantly.
            // Stopping the tracks here permanently breaks the camera!
            // Let's NOT stop the tracks immediately if we're in dev mode or fast re-mount
            setTimeout(() => {
                // If it's still not active after 1000ms, then stop it
                if (!videoRef.current?.srcObject) {
                    stream.getTracks().forEach(track => track.stop());
                }
            }, 1000);
            return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadeddata = () => {
                predictWebcam();
                onVideoReady?.(videoRef.current!);
            };
          }
        } catch (err) {
          console.error("[CameraMonitor] Camera access error:", err);
          setFeedbackMsg("Camera access denied.");
        }
      }
    };

    initMediaPipe();

    return () => {
      isActive = false;
      isComponentMountedRef.current = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      
      if (videoRef.current && videoRef.current.srcObject) {
        try {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
          videoRef.current.srcObject = null;
        } catch (e) {
          console.warn("[CameraMonitor] Error stopping tracks:", e);
        }
      }
    };
  }, [mediaStream]);

  const predictWebcam = () => {
    if (!isComponentMountedRef.current) return;
    const video = videoRef.current;
    const landmarker = faceLandmarkerRef.current;
    if (!video || !landmarker || isLocked) return;

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
          // Ensure strictly increasing timestamp for MediaPipe
          if (startTimeMs <= (landmarker as any).lastStartTimeMs) {
            startTimeMs = (landmarker as any).lastStartTimeMs + 1;
          }
          (landmarker as any).lastStartTimeMs = startTimeMs;

          const result = landmarker.detectForVideo(video, startTimeMs);
          processResult(result);
          
          if (devOverlay) {
            drawDevOverlay(result, video);
          }
        }
      }

      // Heartbeat logic
      if (now - lastHeartbeatTimeRef.current >= HEARTBEAT_INTERVAL) {
        const instantaneousFps = (frameCountRef.current * 1000) / (now - lastHeartbeatTimeRef.current);
        smoothedFpsRef.current = (smoothedFpsRef.current * 0.7) + (instantaneousFps * 0.3);
        const fps = Math.round(smoothedFpsRef.current);
        frameCountRef.current = 0;
        
        onHeartbeat?.({
          fps,
          lastDetectionAgoMs: now - lastProcessTimeRef.current,
          trackingConfidence: lastConfidenceRef.current,
          gazeDirection: lastGazeDirectionRef.current,
          detectionHealth: lastDetectionHealthRef.current,
          engineState: 'READY'
        });
        lastHeartbeatTimeRef.current = now;
      }
    } catch (err) {
      console.error("[CameraMonitor] Error in predictWebcam loop:", err);
    } finally {
      // ALWAYS queue the next frame, even if this one errored, to prevent freezing!
      animationFrameIdRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  const processResult = (result: any) => {
    let validFaceIndex = -1;
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

    if (validFaceLandmarks.length > 0) {
      validFaceIndex = 0;
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

    if (hasFace && validFaceIndex >= 0) {
      const bestIdx = validFaceIndex;
      const blendshapes = result.faceBlendshapes ? result.faceBlendshapes[bestIdx] : null;
      const landmarks = validFaceLandmarks[bestIdx];

      // Calculate Bounding Box and Face Position
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

      // 1. Raw Head Pose Estimation
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

      // 2. Exponential Smoothing
      headPitch = lastPitchRef.current * SMOOTHING + rawPitch * (1 - SMOOTHING);
      headYaw = lastYawRef.current * SMOOTHING + rawYaw * (1 - SMOOTHING);
      headRoll = lastRollRef.current * SMOOTHING + rawRoll * (1 - SMOOTHING);

      lastPitchRef.current = headPitch;
      lastYawRef.current = headYaw;
      lastRollRef.current = headRoll;

      // 3. Baseline Calibration
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

      if (baselinePitchRef.current !== null && baselineYawRef.current !== null && baselineRollRef.current !== null) {
          calibPitch -= baselinePitchRef.current;
          calibYaw -= baselineYawRef.current;
          calibRoll -= baselineRollRef.current;
      }
      
      headPitch = Math.round(calibPitch);
      headYaw = Math.round(calibYaw);
      headRoll = Math.round(calibRoll);

      // Jitter calculation
      const jitterMagnitude = (Math.abs(rawYaw - lastYawRef.current) / 90 + Math.abs(rawPitch - lastPitchRef.current) / 80) / 2;
      const trackingStabilityScore = Math.max(0, 1.0 - jitterMagnitude * 2);

      // Face Size Score
      const faceSizeScore = Math.min(1.0, faceArea / 0.15);
      
      // Centering Score
      const distFromCenter = Math.sqrt(Math.pow(faceCenterX - 0.5, 2) + Math.pow(faceCenterY - 0.5, 2));
      const centeringScore = Math.max(0, 1.0 - distFromCenter * 2);
      
      // Landmark Coverage
      const landmarkCoverageScore = landmarks.length === 478 ? 1.0 : 0.0;

      trackingConfidence = (faceSizeScore * 0.40 + centeringScore * 0.30 + trackingStabilityScore * 0.30) * 100;
      
      if (faceArea < MIN_FACE_AREA) {
         trackingConfidence *= 0.5; // Penalty
      }
      trackingConfidence = Math.max(0, Math.min(100, trackingConfidence));

      // 4. Gaze tracking with Hysteresis
      if (blendshapes && blendshapes.categories && blendshapes.categories.length > 0) {
        const eyeLookInLeft = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookInLeft')?.score || 0;
        const eyeLookOutLeft = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookOutLeft')?.score || 0;
        const eyeLookUpLeft = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookUpLeft')?.score || 0;
        const eyeLookDownLeft = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookDownLeft')?.score || 0;
        
        const eyeLookInRight = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookInRight')?.score || 0;
        const eyeLookOutRight = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookOutRight')?.score || 0;
        const eyeLookUpRight = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookUpRight')?.score || 0;
        const eyeLookDownRight = blendshapes.categories.find((c: any) => c.categoryName === 'eyeLookDownRight')?.score || 0;

        const userLookingLeft = (eyeLookOutLeft + eyeLookInRight) / 2;
        const userLookingRight = (eyeLookInLeft + eyeLookOutRight) / 2;
        const userLookingUp = (eyeLookUpLeft + eyeLookUpRight) / 2;
        const userLookingDown = (eyeLookDownLeft + eyeLookDownRight) / 2;

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
        
        const mouthActivity = blendshapes.categories.filter((b: any) => 
          ['mouthPucker', 'mouthFunnel', 'mouthLowerDownLeft', 'mouthLowerDownRight', 
           'mouthUpperUpLeft', 'mouthUpperUpRight', 'jawOpen'].includes(b.categoryName)
        ).reduce((sum: number, b: any) => sum + b.score, 0);

        isMouthMoving = mouthActivity > 0.45;
        const smile = blendshapes.categories.find((b: any) => b.categoryName === 'mouthSmileLeft')?.score || 0;
        expression = isMouthMoving ? 'Speaking' : (smile > 0.4 ? 'Smiling' : 'Neutral');
      }

    } else {
        faceTrackingStartTimeRef.current = null;
        if (!faceLostTimeRef.current) {
           faceLostTimeRef.current = Date.now();
        }
        
        facePosition = 'CENTERED';
        headPitch = 0;
        headYaw = 0;
        headRoll = 0;
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
      facePosition
    };

    onDetectionFrame?.(frameData);
  };

  const drawDevOverlay = (result: any, video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas dimensions to video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (result.faceLandmarks) {
      const validIndices: number[] = [];
      result.faceLandmarks.forEach((landmarks: any, i: number) => {
        const fw = Math.abs(landmarks[454].x - landmarks[234].x);
        const fh = Math.abs(landmarks[152].y - landmarks[10].y);
        
        let maxBlend = 0;
        if (result.faceBlendshapes && result.faceBlendshapes[i] && result.faceBlendshapes[i].categories) {
          maxBlend = result.faceBlendshapes[i].categories.reduce((m: number, c: any) => Math.max(m, c.score), 0);
        }
        
        if (fw > 0.02 && fh > 0.02 && maxBlend >= 0) {
          validIndices.push(i);
        }
      });

      validIndices.forEach((faceIdx: number, index: number) => {
        const landmarks = result.faceLandmarks[faceIdx];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (let i = 0; i < landmarks.length; i++) {
           const x = landmarks[i].x * canvas.width;
           const y = landmarks[i].y * canvas.height;
           minX = Math.min(minX, x);
           minY = Math.min(minY, y);
           maxX = Math.max(maxX, x);
           maxY = Math.max(maxY, y);
        }

        // Add padding
        minX -= 15; minY -= 15; maxX += 15; maxY += 15;
        const width = maxX - minX;

        // Draw Corner Brackets
        ctx.strokeStyle = '#00FFCC';
        ctx.lineWidth = 3;
        const l = 25; // Corner line length
        
        ctx.beginPath();
        // Top Left
        ctx.moveTo(minX, minY + l); ctx.lineTo(minX, minY); ctx.lineTo(minX + l, minY);
        // Top Right
        ctx.moveTo(maxX - l, minY); ctx.lineTo(maxX, minY); ctx.lineTo(maxX, minY + l);
        // Bottom Right
        ctx.moveTo(maxX, maxY - l); ctx.lineTo(maxX, maxY); ctx.lineTo(maxX - l, maxY);
        // Bottom Left
        ctx.moveTo(minX + l, maxY); ctx.lineTo(minX, maxY); ctx.lineTo(minX, maxY - l);
        ctx.stroke();

        // Draw Eye Crosshairs (Pupils)
        const drawPupil = (idx: number) => {
          if (landmarks[idx]) {
            const px = landmarks[idx].x * canvas.width;
            const py = landmarks[idx].y * canvas.height;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#00FFCC';
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px - 10, py); ctx.lineTo(px + 10, py);
            ctx.moveTo(px, py - 10); ctx.lineTo(px, py + 10);
            ctx.stroke();
          }
        };
        drawPupil(468); // Left Pupil
        drawPupil(473); // Right Pupil

        // Draw HUD Text Box
        // We must UN-MIRROR the text because the canvas is scale-x-[-1]
        ctx.save();
        ctx.scale(-1, 1);
        
        // In mirrored space, the box starts at -maxX
        const textX = -maxX;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(textX, minY - 40, Math.max(160, width), 35);
        
        // HUD Status Text
        ctx.fillStyle = '#00FFCC';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`CANDIDATE_${index + 1} [LOCKED]`, textX + 6, minY - 24);
        
        // Pitch/Yaw estimation text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px monospace';
        const pitch = Math.round((landmarks[1].y - landmarks[10].y) * 100);
        const yaw = Math.round((landmarks[1].x - landmarks[234].x) * 100);
        
        const faceWidth = Math.abs(landmarks[454].x - landmarks[234].x);
        let gazeStateText = 'CENTER';
        if (faceWidth > 0.02) {
           const noseRelX = (landmarks[1].x - landmarks[234].x) / faceWidth;
           gazeStateText = (noseRelX < 0.25 || noseRelX > 0.75) ? 'AWAY' : 'CENTER';
        }
        
        ctx.fillText(`PITCH:${pitch} YAW:${yaw} GAZE:${gazeStateText}`, textX + 6, minY - 10);
        
        ctx.restore();
      });
    }
  };

  // If we are given a media stream, we might want to render just the canvas overlay 
  // over the parent's video element instead of our own. But for simplicity and backward compat,
  // we render our own video element and position it absolutely or relatively based on context.
  // In the dynamic interview screen, this component might be made hidden while still processing.
  
  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain transform scale-x-[-1]"
      />

      {devOverlay && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none transform scale-x-[-1] z-50"
        />
      )}

      {!mediaStream && !isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
          <div className="flex flex-col items-center text-slate-500 gap-3">
            <Camera className="animate-ping" size={32} />
            <span className="text-xs font-mono">{feedbackMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};

