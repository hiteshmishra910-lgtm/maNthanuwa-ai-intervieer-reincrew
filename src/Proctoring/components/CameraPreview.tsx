import React, { useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';
import { forwardRef } from 'react';

interface CameraPreviewProps {
  stream: MediaStream | null;
  mirrored?: boolean;
  showPlaceholder?: boolean;
  statusOverlay?: React.ReactNode;
}

/**
 * CameraPreview — Pure video renderer. No AI, no MediaPipe, no detection logic.
 * 
 * Renders any MediaStream (local webcam, WebRTC remote, etc.) into a video element.
 * If stream is null and showPlaceholder is true, displays a "no preview" placeholder.
 */
// export const CameraPreview: React.FC<CameraPreviewProps> = ({
//   stream,
//   mirrored = true,
//   showPlaceholder = false,
//   statusOverlay,
// }) => {
//   const videoRef = useRef<HTMLVideoElement>(null);

export const CameraPreview = forwardRef<HTMLVideoElement, CameraPreviewProps>(({
  stream,
  mirrored = true,
  showPlaceholder = false,
  statusOverlay,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Merge internal ref with forwarded ref
  const setRef = (el: HTMLVideoElement | null) => {
    (videoRef as any).current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as any).current = el;
  };

  // useEffect(() => {
  //   const video = videoRef.current;
  //   if (!video) return;

  //   if (stream) {
  //     video.srcObject = stream;
  //     video.play().catch(e => console.warn('[CameraPreview] Auto-play prevented:', e));
  //   } else {
  //     video.srcObject = null;
  //   }

  //   return () => {
  //     if (video) {
  //       video.srcObject = null;
  //     }
  //   };
  // }, [stream]);

    useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(e => console.warn('[CameraPreview] Auto-play prevented:', e));
    } else {
      video.srcObject = null;
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={setRef}
        autoPlay
        playsInline
        muted
        webkit-playsinline="true"
        x5-playsinline="true"
        className={`w-full h-full object-cover ${mirrored ? 'transform scale-x-[-1]' : ''}`}
      />

      {/* Placeholder when no stream is available */}
      {!stream && showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
          <div className="flex flex-col items-center text-slate-500 gap-3 text-center px-4">
            <Camera size={32} className="text-slate-600" />
            <div>
              <p className="text-xs font-bold text-slate-400">✓ Phone Connected</p>
              <p className="text-xs font-bold text-slate-400">✓ AI Running</p>
              <p className="text-[10px] text-slate-500 mt-1">Preview unavailable on this network.</p>
            </div>
          </div>
        </div>
      )}

      {/* No stream and no placeholder — generic loading */}
      {!stream && !showPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-20">
          <div className="flex flex-col items-center text-slate-500 gap-3">
            <Camera className="animate-ping" size={32} />
            <span className="text-xs font-mono">Initializing optics...</span>
          </div>
        </div>
      )}

      {/* Status overlay slot (badges, latency, etc.) */}
      {statusOverlay && (
        <div className="absolute bottom-2 left-2 z-30">
          {statusOverlay}
        </div>
      )}
    </div>
  );
});
