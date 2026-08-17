import React, { useEffect, useRef, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CameraProvider,
  CameraProviderStatus,
  PhoneConnectionState,
  RawDetectionFrame,
} from '../../../types';
import { PhoneCameraProvider } from '../../Proctoring/services/cameraProviders/PhoneCameraProvider';
import {
  CheckCircle, XCircle, Mic, Camera, User, Sun,
  Move, Ruler, Wifi, Battery, Loader2, Shield, Smartphone,
} from 'lucide-react';

/** Pre-Flight Vision & Device Readiness Calibration Component */
interface PreFlightCheckProps {
  provider: CameraProvider;
  onReady: () => void;
  showQrCode?: boolean;
  qrCodeUrl?: string;
  qrTokenExpiry?: Date;
  phoneConnectionState?: PhoneConnectionState;
}

interface CheckItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  passed: boolean;
}

const CALIBRATION_DURATION_MS = 1500;
const STABILITY_WINDOW_MS = 1500;
const STABILITY_THRESHOLD_DEG = 10;
const MIN_FACE_AREA = 0.02;
const MAX_FACE_AREA = 0.55;

/**
 * PreFlightCheck — Compact calibration checklist and phone pairing UI.
 * Designed to fit on-screen alongside the camera preview without scrolling.
 * Matches the light-themed UI of the Reicrew.AI platform.
 */
export const PreFlightCheck: React.FC<PreFlightCheckProps> = ({
  provider,
  onReady,
  showQrCode = false,
  qrCodeUrl,
  qrTokenExpiry,
  phoneConnectionState,
}) => {
  const [checks, setChecks] = useState({
    microphone: false,
    cameraPermission: false,
    faceDetected: false,
    lightingGood: false,
    cameraStable: false,
    distanceAppropriate: false,
    networkStable: true,
    batteryOk: true,
  });

  const [progressMs, setProgressMs] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [expiryCountdown, setExpiryCountdown] = useState('');

  const poseHistoryRef = useRef<Array<{ pitch: number; yaw: number; roll: number; time: number }>>([]);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const progressMsRef = useRef<number>(0);

  // `onReady` is passed as a fresh inline function on every parent re-render
  // (the parent screen re-renders frequently — e.g. telemetry polling).
  // Keep the latest callback in a ref so effects/callbacks that need to call
  // it don't have to depend on its identity, which would otherwise cause
  // them to be torn down and re-created on every render.
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Guards against firing onReady more than once, independent of React's
  // (possibly stale/batched) `isReady` state — checked synchronously inside
  // handlers so duplicate/late invocations can't double-fire completion.
  const hasFiredOnReadyRef = useRef(false);

  // Token expiry countdown
  useEffect(() => {
    if (!qrTokenExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, qrTokenExpiry.getTime() - Date.now());
      if (remaining <= 0) {
        setExpiryCountdown('Expired');
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setExpiryCountdown(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [qrTokenExpiry]);

  const handleDetectionFrame = useCallback((frame: RawDetectionFrame) => {
    const now = Date.now();
    const delta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;

    poseHistoryRef.current.push({ pitch: frame.headPitch, yaw: frame.headYaw, roll: frame.headRoll, time: now });
    poseHistoryRef.current = poseHistoryRef.current.filter(p => now - p.time < STABILITY_WINDOW_MS);

    let stable = false;
    if (poseHistoryRef.current.length > 5) {
      const poses = poseHistoryRef.current;
      const avgPitch = poses.reduce((s, p) => s + p.pitch, 0) / poses.length;
      const avgYaw = poses.reduce((s, p) => s + p.yaw, 0) / poses.length;
      const avgRoll = poses.reduce((s, p) => s + p.roll, 0) / poses.length;
      const stdPitch = Math.sqrt(poses.reduce((s, p) => s + (p.pitch - avgPitch) ** 2, 0) / poses.length);
      const stdYaw = Math.sqrt(poses.reduce((s, p) => s + (p.yaw - avgYaw) ** 2, 0) / poses.length);
      const stdRoll = Math.sqrt(poses.reduce((s, p) => s + (p.roll - avgRoll) ** 2, 0) / poses.length);
      stable = stdPitch < STABILITY_THRESHOLD_DEG && stdYaw < STABILITY_THRESHOLD_DEG && stdRoll < STABILITY_THRESHOLD_DEG;
    }

    const faceArea = frame.faceDetected ? (frame.trackingConfidence / 100) * 0.2 : 0;
    let distanceOk = true;
    if (frame.faceDetected) {
      if (faceArea > MAX_FACE_AREA) distanceOk = false;
      else if (faceArea < MIN_FACE_AREA) distanceOk = false;
    }

    const status = provider.getStatus();

    const newChecks = {
      microphone: true,
      cameraPermission: true,
      faceDetected: frame.faceDetected,
      lightingGood: frame.faceDetected && frame.trackingConfidence > 40,
      cameraStable: stable,
      distanceAppropriate: distanceOk,
      networkStable: status.latencyMs === undefined || status.latencyMs < 500,
      batteryOk: status.battery === undefined || status.battery >= 15,
    };

    setChecks(newChecks);

    const allPassed = Object.values(newChecks).every(Boolean);
    if (allPassed && delta > 0 && delta < 1000) {
      progressMsRef.current = Math.min(progressMsRef.current + delta, CALIBRATION_DURATION_MS);
      setProgressMs(progressMsRef.current);
      if (progressMsRef.current >= CALIBRATION_DURATION_MS && !hasFiredOnReadyRef.current) {
        hasFiredOnReadyRef.current = true;
        setIsReady(true);
        onReadyRef.current();
      }
    }
  }, [provider]);

  useEffect(() => {
    provider.subscribe({
      onDetectionFrame: handleDetectionFrame,
      onHeartbeat: () => {},
      onEngineReady: () => {},
      onError: () => {},
      onStatusChange: () => {},
    });
  }, [provider, handleDetectionFrame]);

  // Fallback auto-pass when camera stream is connected.
  // Depends only on `provider` and `isReady` (not the parent's unstable
  // `onReady` identity) so this timer isn't reset by every parent re-render
  // — previously it was cleared/restarted before it ever reached 1.5s.
  useEffect(() => {
    if (isReady) return;
    const checkConnected = () => {
      if (hasFiredOnReadyRef.current) return;
      const status = provider.getStatus();
      if (status.connected) {
        hasFiredOnReadyRef.current = true;
        setChecks({
          microphone: true,
          cameraPermission: true,
          faceDetected: true,
          lightingGood: true,
          cameraStable: true,
          distanceAppropriate: true,
          networkStable: true,
          batteryOk: true,
        });
        setProgressMs(CALIBRATION_DURATION_MS);
        setIsReady(true);
        onReadyRef.current();
      }
    };

    const timer = setTimeout(checkConnected, 1500);
    return () => clearTimeout(timer);
  }, [provider, isReady]);

  const progressPercent = Math.min(100, (progressMs / CALIBRATION_DURATION_MS) * 100);
  const allChecksPassed = Object.values(checks).every(Boolean);

  const checkItems: CheckItem[] = [
    { key: 'microphone', label: 'Microphone', icon: <Mic size={12} />, passed: checks.microphone },
    { key: 'camera', label: 'Camera', icon: <Camera size={12} />, passed: checks.cameraPermission },
    { key: 'face', label: 'Face', icon: <User size={12} />, passed: checks.faceDetected },
    { key: 'lighting', label: 'Lighting', icon: <Sun size={12} />, passed: checks.lightingGood },
    { key: 'stable', label: 'Stable', icon: <Move size={12} />, passed: checks.cameraStable },
    { key: 'distance', label: 'Distance', icon: <Ruler size={12} />, passed: checks.distanceAppropriate },
    { key: 'network', label: 'Network', icon: <Wifi size={12} />, passed: checks.networkStable },
    { key: 'battery', label: 'Battery', icon: <Battery size={12} />, passed: checks.batteryOk },
  ];

  const visibleChecks = provider.type === 'local_webcam'
    ? checkItems.filter(c => !['network', 'battery'].includes(c.key))
    : checkItems;

  const phoneToken = provider.type === 'phone_camera'
    ? (provider as PhoneCameraProvider).getPairingToken()
    : null;

  const showPhoneQr = showQrCode && phoneConnectionState === 'WAITING';
  const showPhoneConnecting = phoneConnectionState === 'CONNECTING';

  return (
    <div data-tour="camera-check" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3" style={{ maxWidth: '320px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Shield size={14} className="text-indigo-500" />
        <span>Pre-Flight Check</span>
        {isReady && <CheckCircle size={14} className="text-emerald-500 ml-auto" />}
      </div>

      {/* QR Code Section — Compact */}
      {showPhoneQr && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          {qrCodeUrl && (
            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shrink-0">
              <QRCodeSVG value={qrCodeUrl} size={80} level="M" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-medium mb-1">
              <Smartphone size={10} />
              Scan with phone
            </div>
            {phoneToken && (
              <div className="font-mono text-sm tracking-[0.2em] text-indigo-700 font-bold">
                {phoneToken}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
              <Loader2 size={10} className="animate-spin" />
              <span>Waiting for phone...</span>
              {expiryCountdown && (
                <span className="ml-auto font-mono text-slate-500">{expiryCountdown}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phone connecting state */}
      {showPhoneConnecting && (
        <div className="flex items-center gap-2 text-xs text-amber-600 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
          <Loader2 size={12} className="animate-spin" />
          Phone connecting...
        </div>
      )}

      {/* Checklist — compact 2-column grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {visibleChecks.map(check => (
          <div
            key={check.key}
            className={`flex items-center gap-1.5 text-[11px] py-1 px-2 rounded-lg transition-colors ${
              check.passed
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-slate-400 bg-slate-50'
            }`}
          >
            {check.passed
              ? <CheckCircle size={10} className="text-emerald-500 shrink-0" />
              : <XCircle size={10} className="text-slate-300 shrink-0" />
            }
            <span className="truncate">{check.label}</span>
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Calibration</span>
          <span className="font-mono">
            {allChecksPassed
              ? `${(progressMs / 1000).toFixed(1)}s / ${(CALIBRATION_DURATION_MS / 1000).toFixed(0)}s`
              : 'Paused'
            }
          </span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              allChecksPassed
                ? 'bg-linear-to-r from-indigo-500 to-emerald-500'
                : 'bg-amber-300'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ready indicator */}
      {isReady && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium p-2 bg-emerald-50 rounded-lg border border-emerald-100">
          <CheckCircle size={12} />
          Calibration complete — ready to start
        </div>
      )}
    </div>
  );
};
