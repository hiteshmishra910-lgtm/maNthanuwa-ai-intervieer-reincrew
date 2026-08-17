import React, { useEffect, useRef, useState } from 'react';
import { MobileProctorService, MobileProctorStatus } from '../services/MobileProctorService';
import { RawDetectionFrame } from '../../../types';
import { CameraPreview } from './CameraPreview';
import { 
  Shield, CheckCircle, XCircle, Battery, 
  Thermometer, Tv, AlertTriangle, Play, Smartphone
} from 'lucide-react';

export const MobileProctorScreen: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [status, setStatus] = useState<MobileProctorStatus | null>(null);
  const [lastFrame, setLastFrame] = useState<RawDetectionFrame | null>(null);

  const serviceRef = useRef<MobileProctorService | null>(null);

  // Auto-fill token from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
      handleConnect(tokenParam);
    }
  }, []);

  const handleConnect = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setIsInitializing(true);
    setError(null);

    try {
      const service = new MobileProctorService();
      serviceRef.current = service;

      // 1. Initialize (resolves token, consumes token, binds connection ID, joins realtime channel, starts WebRTC)
      const session = await service.initialize(tokenToUse);
      setSessionId(session.sessionId);
      setCandidateName(session.candidateName);

      // Register callbacks
      service.onStatus((newStatus) => {
        setStatus(newStatus);
      });

      service.onFrame((frame) => {
        setLastFrame(frame);
      });

      // 2. Start (preloads MediaPipe, starts camera, starts loop, starts WebRTC video)
      await service.start();

      setIsInitializing(false);
    } catch (err: any) {
      console.error('[MobileProctorScreen] Connection failed:', err);
      setError(err.message || 'Failed to connect. Please check the token.');
      setIsInitializing(false);
      if (serviceRef.current) {
        serviceRef.current.dispose();
        serviceRef.current = null;
      }
    }
  };

  useEffect(() => {
    return () => {
      if (serviceRef.current) {
        serviceRef.current.dispose();
      }
    };
  }, []);

  // UI helpers for face guide
  const isFaceDetected = lastFrame?.faceDetected ?? false;
  const isCentered = lastFrame?.facePosition === 'CENTERED';
  const trackingConfidence = lastFrame?.trackingConfidence ?? 0;
  const batteryLevel = status?.battery ?? null;
  const thermalState = status?.thermal ?? 'normal';
  const fps = status?.fps ?? 0;
  const connectionId = status?.connectionId ?? '';

  // Calibration/Position checks
  const checks = {
    angle: isFaceDetected && Math.abs(lastFrame?.headPitch ?? 0) < 15 && Math.abs(lastFrame?.headYaw ?? 0) < 15,
    distance: isFaceDetected && trackingConfidence > 50,
    eyesVisible: isFaceDetected && lastFrame?.gazeDirection !== 'away',
    stable: isFaceDetected && trackingConfidence > 60,
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-full">
              <Smartphone size={32} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Proctoring Companion</h1>
            <p className="text-sm text-slate-400">
              Enter the 8-character token displayed on your desktop screen to pair your phone camera.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Pairing Token
              </label>
              <input
                type="text"
                placeholder="E.g. H4X9M2QP"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase().trim())}
                disabled={isInitializing}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-widest text-cyan-300 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-xs text-red-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={() => handleConnect(token)}
              disabled={isInitializing || !token}
              className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isInitializing ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Pairing Connection...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  Connect Camera
                </>
              )}
            </button>
          </div>

          <div className="border-t border-slate-800/80 pt-4 flex justify-center items-center gap-2 text-[10px] text-slate-500">
            <Shield size={12} />
            <span>Secure Peer-to-Peer Encryption</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <div>
            <h2 className="text-xs font-semibold text-slate-200">Session Connected</h2>
            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
              Candidate: {candidateName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          {batteryLevel !== null && (
            <div className="flex items-center gap-1">
              <Battery size={14} className={batteryLevel < 15 ? 'text-red-500 animate-bounce' : 'text-slate-400'} />
              <span className={batteryLevel < 15 ? 'text-red-500 font-bold' : ''}>{batteryLevel}%</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Thermometer size={14} className={thermalState !== 'normal' ? 'text-amber-500' : 'text-slate-400'} />
            <span className="capitalize">{thermalState}</span>
          </div>
        </div>
      </header>

      {/* Main Video Area */}
      <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {serviceRef.current?.getStream() ? (
          <div className="w-full h-full relative">
            <CameraPreview 
              stream={serviceRef.current.getStream()} 
              mirrored={true} 
              showPlaceholder={false}
            />

            {/* Face Alignment Overlay Guide */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`w-48 h-64 border-2 border-dashed rounded-[40px] transition-colors duration-300 ${
                isFaceDetected ? (isCentered ? 'border-emerald-500 bg-emerald-500/5' : 'border-amber-500 bg-amber-500/5') : 'border-slate-500/30'
              }`} />
            </div>

            {/* Position Instruction Overlay */}
            <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-sm border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-300">
                {!isFaceDetected 
                  ? 'Position your face inside the guide' 
                  : !isCentered 
                    ? 'Center your face in the box'
                    : 'Positioning is perfect'}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                Inference: {fps} FPS
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
            <span className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin block mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-mono">Initializing local device...</p>
          </div>
        )}
      </main>

      {/* Checklist / Wizard Section */}
      <section className="bg-slate-900 border-t border-slate-800 p-4 space-y-4">
        {batteryLevel !== null && batteryLevel < 15 && (
          <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-400 animate-pulse">
            <AlertTriangle size={16} className="shrink-0" />
            <div className="font-medium">
              Battery Critically Low! Connect charger immediately to avoid proctoring failure.
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-colors ${
            checks.angle ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400' : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
          }`}>
            {checks.angle ? <CheckCircle size={14} /> : <XCircle size={14} />}
            <span>Good Camera Angle</span>
          </div>

          <div className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-colors ${
            checks.distance ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400' : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
          }`}>
            {checks.distance ? <CheckCircle size={14} /> : <XCircle size={14} />}
            <span>Optimal Distance</span>
          </div>

          <div className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-colors ${
            checks.eyesVisible ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400' : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
          }`}>
            {checks.eyesVisible ? <CheckCircle size={14} /> : <XCircle size={14} />}
            <span>Eyes Visible</span>
          </div>

          <div className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-colors ${
            checks.stable ? 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400' : 'bg-slate-950/40 border-slate-800/40 text-slate-500'
          }`}>
            {checks.stable ? <CheckCircle size={14} /> : <XCircle size={14} />}
            <span>Device Stable</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 items-center justify-center text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5 font-mono">
            <Tv size={10} />
            <span>Connection ID: {connectionId}</span>
          </div>
          <p className="text-center font-bold text-amber-500 mt-1 uppercase tracking-wider animate-pulse text-[9px]">
            ⚠️ Do NOT close or minimize this browser tab
          </p>
        </div>
      </section>
    </div>
  );
};
