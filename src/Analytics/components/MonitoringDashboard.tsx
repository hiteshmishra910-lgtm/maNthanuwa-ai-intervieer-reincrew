import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { DashboardTelemetry, ProctoringState } from '../../../types';

interface MonitoringDashboardProps {
  telemetry: DashboardTelemetry;
  proctoring: ProctoringState;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ telemetry, proctoring }) => {
  const hasFace = telemetry.faceDetected;
  const isStalled = telemetry.fps === 0 || proctoring.heartbeat.lastDetectionAgoMs > 2000;
  
  // FPS Color Logic
  let fpsColor = "text-emerald-400";
  let fpsLabel = "Healthy";
  if (telemetry.fps === 0) { fpsColor = "text-rose-500"; fpsLabel = "Stalled"; }
  else if (telemetry.fps < 10) { fpsColor = "text-orange-500"; fpsLabel = "Warning"; }
  else if (telemetry.fps <= 20) { fpsColor = "text-amber-400"; fpsLabel = "Degraded"; }

  // Quality Color Logic
  let qualityColor = "text-emerald-400";
  if (telemetry.monitoringQualityScore < 40) qualityColor = "text-rose-500";
  else if (telemetry.monitoringQualityScore < 70) qualityColor = "text-amber-400";

  return (
    <div className="flex flex-col gap-4 w-full">
      
      {/* 1. Stalled / Recovery Warning */}
      {isStalled && (
        <div className="bg-rose-500/20 border border-rose-500/50 p-3 rounded-lg flex items-center gap-3">
          <AlertTriangle className="text-rose-500 w-5 h-5 shrink-0 animate-pulse" />
          <span className="text-sm font-bold text-rose-500">🚨 Monitoring Stalled</span>
        </div>
      )}
      {proctoring.engineState === 'RECOVERING' && (
        <div className="bg-amber-500/20 border border-amber-500/50 p-3 rounded-lg flex items-center gap-3">
          <Loader2 className="text-amber-500 w-5 h-5 shrink-0 animate-spin" />
          <span className="text-sm font-bold text-amber-500">⚠ Camera Recovery In Progress...</span>
        </div>
      )}

      {/* 2. Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1">Status</div>
          <div className="font-bold text-emerald-400">ACTIVE</div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1">FPS</div>
          <div className={`font-bold flex gap-1 ${fpsColor}`}>
            <span>{telemetry.fps}</span>
            <span>{telemetry.fps > 20 ? '✓' : '⚠'}</span>
            <span>{fpsLabel}</span>
          </div>
        </div>
        
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1 flex justify-between">
             <span>Tracking Confidence</span>
          </div>
          <div className="font-bold">{hasFace ? `${telemetry.trackingConfidence}%` : 'N/A'}</div>
        </div>
        <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1">Gaze</div>
          <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">
            {hasFace ? (() => {
              let dirText = '';
              if (telemetry.gazeDirection === 'center') dirText = 'Looking at screen';
              else if (telemetry.gazeDirection === 'left') dirText = 'Looking left';
              else if (telemetry.gazeDirection === 'right') dirText = 'Looking right';
              else if (telemetry.gazeDirection === 'up') dirText = 'Looking up';
              else if (telemetry.gazeDirection === 'down') dirText = 'Looking down';
              else if (telemetry.gazeDirection === 'away') dirText = 'Looking away';
              else dirText = telemetry.gazeDirection.toUpperCase();

              const durationText = telemetry.gazeDurationMs > 0 ? ` (${(telemetry.gazeDurationMs / 1000).toFixed(1)}s)` : '';
              return `${dirText}${durationText}`;
            })() : 'N/A'}
          </div>
        </div>

        <div className="col-span-2 bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1 flex justify-between">
            <span>Face Position</span>
            <span className="font-bold">{hasFace ? (telemetry.facePosition === 'CENTERED' ? '✓ Centered' : '⚠ Partial Out') : 'N/A'}</span>
          </div>
        </div>

        <div className="col-span-2 bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1 flex justify-between">
            <span>Head Pitch / Yaw / Roll</span>
            <span className="font-bold text-[10px]">
              {hasFace ? 
                `${Math.max(-45, Math.min(45, telemetry.headPitch))}° / ` + 
                `${Math.max(-45, Math.min(45, telemetry.headYaw))}° / ` + 
                `${Math.max(-45, Math.min(45, telemetry.headRoll))}°` 
              : 'N/A'}
            </span>
          </div>
        </div>

        <div className="col-span-2 bg-slate-800/50 p-2 rounded border border-slate-700">
          <div className="text-slate-400 font-semibold mb-1 flex justify-between">
            <span>Monitoring Quality</span>
            <span className={`font-bold ${qualityColor}`}>{telemetry.monitoringQualityScore}%</span>
          </div>
          <div className="w-full bg-slate-700 h-1.5 rounded overflow-hidden mt-1">
             <div className={`h-full ${qualityColor.replace('text-', 'bg-')} transition-all`} style={{ width: `${telemetry.monitoringQualityScore}%` }} />
          </div>
        </div>
      </div>

      {/* 3. Active Violations */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Violations Panel</h3>
        <div className="space-y-2">
           {proctoring.noFaceState === 'VIOLATION_CREATED' && (
             <div className="flex items-center gap-2 text-rose-400 text-sm font-bold bg-rose-500/10 p-2 rounded">
               <span>🚨</span> No Face Detected
             </div>
           )}
           {/*
             * Parenthesised. `&&` binds tighter than `||`, so the previous
             *   A === x || B === y || C === z && (<div/>)
             * parsed as  A || B || (C && <div/>).  With multiFaceState at MULTI_FACE_START the
             * expression short-circuited to the boolean `true`, which React renders as nothing —
             * so the warning never appeared, even though the violation was being recorded. This
             * is why "multiple faces used to work but no longer triggers warnings".
             */}
           {(proctoring.multiFaceState === 'MULTI_FACE_START' || proctoring.multiFaceState === 'MULTI_FACE_CONFIRMED') && (
             <div className="flex items-center gap-2 text-rose-400 text-sm font-bold bg-rose-500/10 p-2 rounded">
               <span>🚨</span>
               {proctoring.multiFaceState === 'MULTI_FACE_CONFIRMED'
                 ? `Multiple Faces in Frame — ${proctoring.maxConcurrentFaces || 2} people detected`
                 : 'Multiple Faces in Frame — confirming…'}
             </div>
           )}
           {proctoring.gazeState === 'VIOLATION_CREATED' && (
             <div className="flex items-center gap-2 text-amber-400 text-sm font-bold bg-amber-500/10 p-2 rounded">
               <span>⚠</span> Looking Away
             </div>
           )}
           {proctoring.noFaceState === 'FACE_PRESENT' && proctoring.multiFaceState === 'SINGLE_FACE' && proctoring.gazeState !== 'VIOLATION_CREATED' && (
             <div className="text-slate-500 text-sm italic text-center py-2">No active violations</div>
           )}
        </div>
      </div>

      {/* 4. Timeline */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 shadow-lg flex-1 flex flex-col min-h-[250px] overflow-hidden">
        <div className="flex items-center justify-between mb-3 shrink-0">
           <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Timeline</h3>
           <div className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-xs font-bold border border-indigo-500/30">
             Risk Score: {proctoring.currentRiskScore}
           </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {proctoring.timeline.length === 0 ? (
            <div className="text-slate-500 text-xs italic text-center py-8">No events recorded yet.</div>
          ) : (
            [...proctoring.timeline].reverse().map((event, i) => {
              let color = "text-slate-300";
              let icon = "•";
              if (event.severity === 1) { color = "text-blue-400"; icon = "ℹ"; }
              else if (event.severity === 2) { color = "text-yellow-400"; icon = "⚠"; }
              else if (event.severity === 3) { color = "text-orange-400"; icon = "⚠"; }
              else if (event.severity >= 4) { color = "text-rose-500 font-bold"; icon = "🚨"; }
              
              const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              return (
                <div key={i} className={`text-xs flex gap-2 items-start p-2 rounded ${event.severity >= 4 ? 'bg-rose-500/10 border border-rose-500/20' : 'hover:bg-slate-700/50'}`}>
                  <span className={`shrink-0 mt-0.5 ${color}`}>{icon}</span>
                  <span className="text-slate-500 font-mono shrink-0">[{time}]</span>
                  <span className={`${color} break-words font-medium`}>{event.event.replace(/_/g, ' ')}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
};
