import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, CheckCircle, AlertCircle, Settings, Shield, ArrowRight, RefreshCw, LogIn, Monitor, Loader2, AlertTriangle } from 'lucide-react';
import { Logo } from '../../Core/components/Logo';
import { useAudioLevel } from '../../Interview/hooks/useAudioLevel';

interface CameraCheckScreenProps {
  onComplete: () => void;
}

export const CameraCheckScreen: React.FC<CameraCheckScreenProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'READY' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const audioLevel = useAudioLevel(stream);

  const startCamera = async () => {
    setStatus('LOADING');
    setErrorMsg('');

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: true
      });

      streamRef.current = newStream;
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            setStatus('READY');
          }).catch(e => {
            setStatus('READY');
          });
        };
      }
    } catch (err: any) {
      console.error("Device initialization failed:", err);
      setStatus('ERROR');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg("Permission denied. Check browser settings.");
      } else if (err.name === 'NotFoundError') {
        setErrorMsg("No camera or mic device found.");
      } else {
        setErrorMsg("Device initialization failed.");
      }
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleStart = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen request failed", err);
    }
    onComplete();
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-slate-50 overflow-hidden">
      <div className="max-w-xl w-full max-h-full flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center shrink-0 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <Logo variant="white" className="w-8 h-8" />
            <h2 className="text-xl font-black flex items-center gap-3">
              Vitals Check
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Reincrew Verification Engine</p>
        </div>

        <div className="p-8 flex flex-col items-center flex-1 overflow-y-auto min-h-0">

          {/* Video Preview */}
          <div className="relative w-full aspect-[4/3] bg-black rounded-[2rem] overflow-hidden shadow-2xl mb-8 border-4 border-white shrink-0">
            {status === 'LOADING' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900">
                <Loader2 size={32} className="animate-spin mb-2 text-indigo-500" />
                <p className="text-xs">Initializing...</p>
              </div>
            )}

            {status === 'ERROR' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-slate-900 p-8 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle size={32} />
                </div>
                <p className="font-black text-lg mb-2 uppercase tracking-tight">Access Locked</p>
                <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-700 ${status === 'READY' ? 'opacity-100' : 'opacity-0'}`}
            />

            {status === 'READY' && (
              <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                <div className="bg-emerald-500 text-white px-4 py-1.5 rounded-full text-xs font-black flex items-center gap-2 shadow-xl animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                   FEED LIVE
                </div>
              </div>
            )}
          </div>

          {/* Combined Visual Indicators */}
          <div className="w-full space-y-6">
            {/* Audio Meter */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Mic size={14} className={audioLevel > 5 ? "text-indigo-500" : "text-slate-300"} />
                        Microphone Level
                    </div>
                    {audioLevel > 5 ? (
                         <span className="text-[10px] font-black text-emerald-500 uppercase">Input Detected</span>
                    ) : (
                        <span className="text-[10px] font-black text-slate-400 uppercase">Waiting for audio...</span>
                    )}
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex gap-0.5 p-0.5">
                    {[...Array(20)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`flex-1 rounded-full transition-all duration-75 ${
                                audioLevel > (i * 5) 
                                ? 'bg-indigo-500' 
                                : 'bg-slate-300/30'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {status === 'ERROR' ? (
              <button
                onClick={startCamera}
                className="w-full py-4 bg-red-600 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-xl shadow-red-100 transform active:scale-95"
              >
                <RefreshCw size={20} /> RETRY CONNECTION
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600 ml-4 mb-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    PRE-FLIGHT CHECKLIST
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Visuals</span>
                        <span className="text-[11px] font-bold text-slate-700">Clear Lighting</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Audio</span>
                        <span className="text-[11px] font-bold text-slate-700">Quiet Room</span>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            onClick={handleStart}
            disabled={status !== 'READY'}
            className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl ${status === 'READY'
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 transform hover:scale-[1.01]'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
              }`}
          >
            I'M READY <ArrowRight size={22} />
          </button>
        </div>

      </div>
    </div>
  );
};
