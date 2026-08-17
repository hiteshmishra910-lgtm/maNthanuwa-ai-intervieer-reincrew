import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, Info, Clock, X } from 'lucide-react';
import { evaluationQueue } from '../../Evaluation/dispatch/EvaluationQueue';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  link?: string;
}

interface NotificationCenterProps {
  sessions?: any[];
  userEmail?: string;
  /** Show hybrid pipeline health alerts (stuck jobs, failures). Admin/HR only. */
  showPipelineAlerts?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ sessions = [], userEmail, showPipelineAlerts = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const normalizedUserEmail = userEmail ? userEmail.toLowerCase().trim() : null;
  const storageKey = `read_notifications_${normalizedUserEmail || 'global'}`;

  // Generate dynamic notifications from candidate sessions
  useEffect(() => {
    const items: NotificationItem[] = [];

    // Filter sessions to only candidate's own sessions if userEmail is provided
    const targetSessions = normalizedUserEmail
      ? sessions.filter((s: any) => {
          const sEmail = (s.candidate_email || s.email || s.candidate?.email || '').toLowerCase().trim();
          return sEmail === normalizedUserEmail;
        })
      : sessions;

    if (targetSessions && targetSessions.length > 0) {
      targetSessions.forEach((s: any) => {
        const isQueued = s.session_status === 'QUEUED' || (s.execution_status !== 'REPORT_SAVED' && s.evaluation_logic?.evaluationStatus === 'QUEUED');
        const isCompleted = s.session_status === 'COMPLETED' && s.execution_status === 'REPORT_SAVED';
        const isTerminated = s.session_status === 'TERMINATED';

        const roleName = s.role || s.job_title || s.drive_title || 'Assessment';
        const candidateName = s.candidate_name || s.name || s.candidate?.name || 'Candidate';

        if (isQueued) {
          items.push({
            id: `notif-queued-${s.session_id || s.id}`,
            title: normalizedUserEmail ? 'Evaluation Queued' : `Queued: ${candidateName}`,
            message: normalizedUserEmail
              ? `Your ${roleName} submission is currently in queue for AI evaluation. Report will be ready shortly.`
              : `Evaluation for ${candidateName} (${roleName}) is queued.`,
            type: 'info',
            timestamp: s.session_date ? new Date(s.session_date).getTime() : Date.now() - 300000,
            read: false,
          });
        } else if (isCompleted) {
          items.push({
            id: `notif-completed-${s.session_id || s.id}`,
            title: normalizedUserEmail ? 'Report Ready' : `Report Ready: ${candidateName}`,
            message: normalizedUserEmail
              ? `Your AI Evaluation Report for ${roleName} has been generated! Click to view scores & feedback.`
              : `AI Evaluation Report for ${candidateName} (${roleName}) is ready.`,
            type: 'success',
            timestamp: s.session_date ? new Date(s.session_date).getTime() : Date.now() - 100000,
            read: true,
          });
        } else if (isTerminated) {
          items.push({
            id: `notif-terminated-${s.session_id || s.id}`,
            title: normalizedUserEmail ? 'Session Flagged / Terminated' : `Flagged: ${candidateName}`,
            message: normalizedUserEmail
              ? `Assessment for ${roleName} was terminated due to proctoring thresholds.`
              : `Assessment for ${candidateName} (${roleName}) was terminated due to proctoring thresholds.`,
            type: 'warning',
            timestamp: s.session_date ? new Date(s.session_date).getTime() : Date.now() - 600000,
            read: true,
          });
        }

        const proctoringEvents = s.all_proctoring_events || s.proctoringReport?.violations || [];
        if (proctoringEvents.length > 0) {
          const highRisk = proctoringEvents.filter((v: any) => v.severity === 'High' || v.severity > 5 || v.severity === 10);
          if (highRisk.length > 0) {
            items.push({
              id: `notif-proctoring-${s.session_id || s.id}`,
              title: normalizedUserEmail ? 'Proctoring Alert' : `Proctoring Alert: ${candidateName}`,
              message: normalizedUserEmail
                ? `${highRisk.length} high-severity proctoring event(s) recorded during ${roleName}.`
                : `${highRisk.length} high-severity proctoring event(s) logged for ${candidateName} (${roleName}).`,
              type: 'warning',
              timestamp: s.session_date ? new Date(s.session_date).getTime() : Date.now() - 300000,
              read: false,
            });
          }
        }
      });
    }

    // System welcome notification
    items.push({
      id: 'notif-system-welcome',
      title: 'Welcome to Reincrew AI',
      message: 'System active. Your interview assessments are automatically evaluated using our AI engine.',
      type: 'info',
      timestamp: Date.now() - 86400000,
      read: true,
    });

    // Load read statuses from localStorage if available
    try {
      const savedReadIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = items.map(item => ({
        ...item,
        read: savedReadIds.includes(item.id) || item.read,
      }));
      setNotifications(updated);
    } catch {
      setNotifications(items);
    }
  }, [sessions, userEmail]);

  // Fetch HR candidate_notifications from database
  useEffect(() => {
    if (!userEmail) return;
    const fetchDbNotifications = async () => {
      try {
        const { supabase } = await import('../database/supabaseClient');
        const { data } = await supabase
          .from('candidate_notifications')
          .select('*')
          .eq('candidate_email', userEmail.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(20);

        if (!data || data.length === 0) return;

        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const dbNotifs: NotificationItem[] = data
            .filter((n: any) => !existingIds.has(`db-${n.id}`))
            .map((n: any) => ({
              id: `db-${n.id}`,
              title: n.title,
              message: n.message,
              type: n.type as NotificationItem['type'],
              timestamp: new Date(n.created_at).getTime(),
              read: !!n.read_at,
            }));
          return [...dbNotifs, ...prev];
        });
      } catch (err) {
        console.warn('[NotificationCenter] Failed to fetch candidate_notifications:', err);
      }
    };
    fetchDbNotifications();
  }, [userEmail]);

  // ── Hybrid pipeline health check — polls every 2 min for stale/failed jobs (admin/HR only) ──
  useEffect(() => {
    if (!showPipelineAlerts) return;
    const checkPipelineHealth = async () => {
      try {
        const health = await evaluationQueue.getPipelineHealth();
        if (health.issues.length === 0) return;

        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNotifs: NotificationItem[] = [];

          if (health.staleJobs > 0) {
            const id = 'pipeline-stale-jobs';
            if (!existingIds.has(id)) {
              newNotifs.push({
                id,
                title: '⚠️ Stuck Evaluation Jobs',
                message: `${health.staleJobs} job(s) stuck in processing for >15 min. The pipeline may need attention.`,
                type: 'warning',
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          if (health.failedJobs > 0) {
            const id = 'pipeline-failed-jobs';
            if (!existingIds.has(id)) {
              newNotifs.push({
                id,
                title: '❌ Permanently Failed Evaluations',
                message: `${health.failedJobs} evaluation(s) failed after all retries. Check the admin dashboard.`,
                type: 'error',
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          if (health.queuedJobs > 0) {
            const id = 'pipeline-queued-backlog';
            if (!existingIds.has(id)) {
              newNotifs.push({
                id,
                title: '⏳ Evaluation Backlog',
                message: `${health.queuedJobs} evaluation(s) waiting >10 min. Queue may be overloaded.`,
                type: 'info',
                timestamp: Date.now(),
                read: false,
              });
            }
          }

          return newNotifs.length > 0 ? [...newNotifs, ...prev] : prev;
        });
      } catch {
        // Silently ignore — monitoring should never crash the UI
      }
    };

    // Initial check after 30s, then every 2 min
    const timeout = setTimeout(checkPipelineHealth, 30000);
    const interval = setInterval(checkPipelineHealth, 120_000);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [showPipelineAlerts]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    try {
      const savedReadIds = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!savedReadIds.includes(id)) {
        savedReadIds.push(id);
        localStorage.setItem(storageKey, JSON.stringify(savedReadIds));
      }
    } catch {
      // Ignore storage errors
    }
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      default:
        return <Info className="w-5 h-5 text-indigo-500" />;
    }
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-400 font-medium rounded-full border border-indigo-500/30">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-slate-800/50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`p-4 transition-colors cursor-pointer flex gap-3 ${
                      notif.read ? 'bg-slate-900/40 hover:bg-slate-800/40' : 'bg-indigo-950/20 hover:bg-indigo-950/30'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">{getIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`text-sm font-medium ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h4>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            clearNotification(notif.id);
                          }}
                          className="text-slate-600 hover:text-slate-400 p-0.5 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{notif.message}</p>
                      <span className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
