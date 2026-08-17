import React, { useState, useEffect, useMemo } from 'react';
import { StorageService } from '../../Core/storage/storageService';
import { InterviewSession, Question, ErrorLog, JobPost, formatFeedbackToString, InterviewRole, InterviewRoles, DEFAULT_PROCTORING_SETTINGS } from '../../../types';
import { supabase } from '../../Core/database/supabaseClient';
import {
    Users, LogOut, Search, Shield, Edit, Plus, Save, X, Trash2, Play,
    Activity, ToggleLeft, ToggleRight, ChevronRight, Link, Copy, CheckCircle,
    Server, Database, AlertTriangle, Terminal, CheckCircle2, BookOpen, RefreshCw, FileText,
    Download, Sliders, Upload, MoreVertical, LayoutDashboard, ShieldAlert, Archive, Lock,
    Calendar, Clock, UserCheck, Mail, Send
} from 'lucide-react';

import { SystemHealth } from '../../Core/monitoring/healthService';
import { useUser } from '@clerk/clerk-react';
import { SupabaseService } from '../../Core/database/supabaseService';
import { DriveRepository } from '../../Core/database/driveRepository';
import { SessionReportView } from '../../Analytics/components/SessionReportView';
import { ErrorLogService } from '../../Core/logging/errorLogService';
import { getQuestionsForRole, DEFAULT_INTERVIEW_TEMPLATE } from '../../Core/ai/aiService';
import { submitAnswer } from '../../Core/api/apiService';
import { ReportGenerator } from '../../Evaluation/pipeline/ReportGenerator';
import { NotificationCenter } from '../../Core/components/NotificationCenter';
import { resolveSessionViewModel, SCORE_PLACEHOLDER, EvaluationModeType, extractSessionScore } from '../../Core/utils/sessionStatusResolver';
import { getEffectiveSessionReport } from '../../Core/utils/reportReconstructor';
import { DataProvider } from '../../Core/data/dataProvider';
import { DashboardCharts } from '../../HR/components/DashboardCharts';
import { DashboardSummary } from '../../Core/demo/demoTypes';
import { DemoToggleSwitch } from '../../Core/components/DemoToggleSwitch';
import { subscribeDemoMode } from '../../Core/demo/demoMode';
import { sessionEvents } from '../../Core/events/sessionEvents';

/**
 * How many questions the default adaptive flow actually asks.
 *
 * Read from the template rather than written down, so the flow chart cannot drift from the
 * engine again. It was hardcoded as 5 while DEFAULT_INTERVIEW_TEMPLATE.steps has held 10 for
 * some time.
 */
const DEFAULT_FLOW_QUESTION_COUNT = DEFAULT_INTERVIEW_TEMPLATE.steps.length;

/**
 * Number of question-type groups shown in the flow chart.
 *
 * These cards filter the question bank by `q.type`; they are a taxonomy, not the interview's
 * length. Kept separate from DEFAULT_FLOW_QUESTION_COUNT precisely because conflating the two is
 * what produced the misleading "Q1 of 5" badge.
 */
const ADAPTIVE_STAGE_COUNT = 5;

interface AdminDashboardProps {
    onLogout: () => void;
    health?: SystemHealth | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, health }) => {
    const { user } = useUser();
    // Tab state
    const [activeTab, setActiveTab] = useState<'dashboard' | 'candidates' | 'questions' | 'proctoring' | 'system' | 'errors'>('dashboard');
    const [adminSummary, setAdminSummary] = useState<DashboardSummary | null>(null);

    // Candidate Sessions state
    const [sessions, setSessions] = useState<InterviewSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    // Questions Editor state
    const [selectedRole, setSelectedRole] = useState<InterviewRole | 'APTITUDE'>('CSE');
    const [isUploading, setIsUploading] = useState(false);
    const [questionsList, setQuestionsList] = useState<Question[]>([]);
    const [questionsFilter, setQuestionsFilter] = useState<string>('all');
    const [isSaving, setIsSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [questionsSubTab, setQuestionsSubTab] = useState<'editor' | 'settings' | 'analytics'>('editor');

    // New Questions Search, Filter, Selection & Pagination state
    const [questionSearchQuery, setQuestionSearchQuery] = useState('');
    const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState<string>('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
    
    // Dialog / Modal triggers
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [balanceModalOpen, setBalanceModalOpen] = useState(false);
    const [balanceSuggestions, setBalanceSuggestions] = useState<{ id: string | number; text: string; current: string; suggested: string }[]>([]);
    
    // Import Wizard state
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importFileContent, setImportFileContent] = useState<string | null>(null);
    const [importFileName, setImportFileName] = useState('');
    const [importPreviewData, setImportPreviewData] = useState<{
        questions: any[];
        validCount: number;
        errors: { row: number; msg: string; severity: 'error' | 'warning' }[];
        warningsCount: number;
        errorsCount: number;
    } | null>(null);
    const [importMergeStrategy, setImportMergeStrategy] = useState<'replace' | 'append'>('append');

    // Job Settings (Global strategy & Technical Stage Overrides)
    const [difficultyStrategy, setDifficultyStrategy] = useState<'Adaptive' | 'Easy Only' | 'Medium Only' | 'Hard Only'>('Adaptive');
    const [stageOverrides, setStageOverrides] = useState<{
        Fundamentals?: 'Adaptive' | 'Easy Only' | 'Medium Only' | 'Hard Only';
        Core?: 'Adaptive' | 'Easy Only' | 'Medium Only' | 'Hard Only';
        Scenario?: 'Adaptive' | 'Easy Only' | 'Medium Only' | 'Hard Only';
    }>({
        Fundamentals: 'Adaptive',
        Core: 'Adaptive',
        Scenario: 'Adaptive'
    });

    // Error Logs state
    const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
    const [errorsFilter, setErrorsFilter] = useState<string>('all');
    const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

    // Test AI Grading Simulator state
    const [testAnswer, setTestAnswer] = useState('');
    const [testResult, setTestResult] = useState<any | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // New Dashboard / Evaluation Filters / Proctoring Settings states
    const [filterType, setFilterType] = useState<'all' | 'completed' | 'pending' | 'queued' | 'flagged' | 'errors' | 'api' | 'local' | 'top' | 'archived'>('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [proctorSettings, setProctorSettings] = useState<any>({
      faceMissingWarningSec: 10,
      faceMissingTerminateSec: 30,
      tabSwitchWarningCount: 2,
      tabSwitchTerminateCount: 5,
      multipleFacesWarningCount: 1,
      multipleFacesTerminateCount: 3,
      cameraOffWarningSec: 10,
      cameraOffTerminateSec: 30,
      micOffWarningSec: 10,
      micOffTerminateSec: 30,
      fullscreenExitWarningCount: 1,
      fullscreenExitTerminateCount: 3,
    });
    const [proctorMetadata, setProctorMetadata] = useState<{ updated_at: string; updated_by: string } | null>(null);
    const [isSavingProctor, setIsSavingProctor] = useState(false);
    const [proctorSuccessMsg, setProctorSuccessMsg] = useState<string | null>(null);
    const [tokenStats, setTokenStats] = useState<any>({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, total_calls: 0 });
    const [globalEvaluationMode, setGlobalEvaluationMode] = useState<'API' | 'LOCAL' | 'HYBRID'>('API');
    const [isSavingMode, setIsSavingMode] = useState(false);
    const [modeSuccessMsg, setModeSuccessMsg] = useState<string | null>(null);
    
    // Per-job proctoring configuration states
    const [aiProctoringEnabled, setAiProctoringEnabled] = useState(true);
    const [cameraMode, setCameraMode] = useState<'auto' | 'webcam' | 'phone'>('auto');
    
    // Modal states for delete confirmation
    const [showConfirmModal, setShowConfirmModal] = useState<'archive' | 'delete' | 'restore' | null>(null);
    const [sessionToConfirm, setSessionToConfirm] = useState<InterviewSession | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Assignment management state
    const [assignments, setAssignments] = useState<any[]>([]);
    const [drives, setDrives] = useState<any[]>([]);
    const [assignmentFilter, setAssignmentFilter] = useState<string>('all');
    const [showAssignForm, setShowAssignForm] = useState(false);
    const [assignFormDriveId, setAssignFormDriveId] = useState('');
    const [assignFormEmail, setAssignFormEmail] = useState('');
    const [assignFormDeadline, setAssignFormDeadline] = useState('');
    const [assignFormMaxAttempts, setAssignFormMaxAttempts] = useState(1);
    const [assignFormCompanyName, setAssignFormCompanyName] = useState('');
    const [assignFormNotes, setAssignFormNotes] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);
    const [assignErrorMsg, setAssignErrorMsg] = useState<string | null>(null);
    const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
    const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');

    useEffect(() => {
        setTestAnswer('');
        setTestResult(null);
        setIsTesting(false);
    }, [editingQuestion]);

    const handleSaveEvaluationMode = async (mode: 'API' | 'LOCAL' | 'HYBRID') => {
        setIsSavingMode(true);
        setModeSuccessMsg(null);
        try {
            try { localStorage.setItem('evaluation_mode', mode); } catch (e) { /* ignore storage error */ }
            const ok = await SupabaseService.saveSystemSettings('evaluation_mode', mode, 'Super Admin');
            if (ok) {
                setGlobalEvaluationMode(mode);
                setModeSuccessMsg("Evaluation mode updated successfully!");
                setTimeout(() => setModeSuccessMsg(null), 3000);
            } else {
                alert("Failed to save evaluation mode settings.");
            }
        } catch (err) {
            console.error("Failed to save evaluation mode:", err);
            alert("An error occurred while saving evaluation mode.");
        } finally {
            setIsSavingMode(false);
        }
    };

    const handleTestGrading = async () => {
        if (!editingQuestion || !testAnswer.trim()) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const mockCandidate = { name: "Test Admin", isDemo: true };
            const result = await submitAnswer(
                mockCandidate as any,
                editingQuestion,
                testAnswer,
                undefined,
                undefined,
                "test-session-id"
            );
            setTestResult(result.evaluation);
        } catch (err: any) {
            console.error("Test grading failed:", err);
            setTestResult({
                error: err.message || "Failed to contact AI evaluator. Please check your network and try again."
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignFormEmail.trim() || !assignFormDriveId) {
            setAssignErrorMsg("Please fill in candidate email and select a drive.");
            return;
        }
        setIsAssigning(true);
        setAssignSuccessMsg(null);
        setAssignErrorMsg(null);

        try {
            await SupabaseService.createAssignment({
                driveId: assignFormDriveId,
                candidateEmail: assignFormEmail.trim(),
                deadline: assignFormDeadline ? new Date(assignFormDeadline).toISOString() : null,
                maxAttempts: assignFormMaxAttempts,
                assignedBy: user?.primaryEmailAddress?.emailAddress || 'Admin',
                notes: assignFormNotes || undefined,
                companyName: assignFormCompanyName || undefined
            });

            setAssignSuccessMsg("Interview assigned successfully!");
            setAssignFormEmail('');
            setAssignFormDriveId('');
            setAssignFormDeadline('');
            setAssignFormMaxAttempts(1);
            setAssignFormCompanyName('');
            setAssignFormNotes('');
            setShowAssignForm(false);

            // Reload
            await loadSessionsAndErrors();
        } catch (err: any) {
            console.error("Failed to assign interview:", err);
            setAssignErrorMsg(err.message || "Failed to assign interview. Please try again.");
        } finally {
            setIsAssigning(false);
        }
    };

    const handleDeleteAssignment = async (assignmentId: string) => {
        if (!window.confirm("Are you sure you want to cancel and delete this assignment?")) {
            return;
        }
        try {
            await SupabaseService.deleteAssignment(assignmentId);
            await loadSessionsAndErrors();
        } catch (err: any) {
            console.error("Failed to delete assignment:", err);
            alert("Failed to delete assignment: " + (err.message || err));
        }
    };

    // Loading indicator
    const [isLoading, setIsLoading] = useState(true);

    // Load initial candidate sessions and error logs
    const loadSessionsAndErrors = async () => {
        setIsLoading(true);
        try {
            const summary = await DataProvider.getDashboardSummary();
            setAdminSummary(summary);

            // Load Sessions via DataProvider boundary (respects Demo Mode ON/OFF and sorts real sessions first)
            const rawSessions = await DataProvider.getSessions();
            if (rawSessions) {
                const mappedSessions: InterviewSession[] = rawSessions.map(rs => {
                    const vmStatus = rs.session_status === 'TERMINATED'
                        ? 'TERMINATED'
                        : (rs.evaluation_logic?.evaluationStatus === 'QUEUED' && rs.session_status !== 'COMPLETED')
                            ? 'QUEUED'
                            : (rs.session_status === 'CREATED' && (rs.questions_answered || 0) > 0 ? 'COMPLETED' : rs.session_status);

                    const mappedResults = rs.all_questions_and_answers ? rs.all_questions_and_answers.map((qb: any, idx: number) => ({
                        questionId: idx + 1,
                        questionText: qb.question_text || `Question ${idx + 1}`,
                        userAnswer: qb.candidate_answer || '',
                        contentScore: qb.content_score,
                        grammarScore: qb.grammar_score,
                        fluencyScore: qb.fluency_score,
                        confidenceScore: qb.confidence,
                        verdict: qb.verdict,
                        feedback: qb.feedback
                    })) : [];

                    const extractedScore = extractSessionScore(rs);
                    return {
                        id: rs.session_id,
                        session_id: rs.session_id,
                        session_status: rs.session_status,
                        questions_answered: rs.questions_answered,
                        questionsAnswered: rs.questions_answered,
                        // Forwarded verbatim so resolveSessionViewModel owns the precedence rules.
                        // This line previously reimplemented a third, shorter version of the
                        // resolution chain, which disagreed with both the shared resolver and the
                        // local one.
                        evaluation_mode: rs.evaluation_mode,
                        evaluationMode: rs.evaluationMode,
                        interview_metadata: rs.interview_metadata,
                        evaluation_logic: rs.evaluation_logic || rs.interview_metadata?.evaluation_logic,
                        candidate: {
                            name: rs.candidate_name || 'Unknown',
                            email: rs.candidate_email || '',
                            role: rs.job_title || 'Unknown',
                            profilePhoto: rs.profile_photo_url,
                            idCardImage: rs.id_card_image_url
                        },
                        status: vmStatus,
                        date: rs.session_date,
                        overall_score: extractedScore,
                        overallScore: extractedScore,
                        terminationReason: rs.termination_reason || null,
                        isDeleted: rs.is_deleted || false,
                        proctoringReport: {
                            violations: rs.all_proctoring_events ? rs.all_proctoring_events.map((v: any) => ({
                                type: v.type || v.event_type,
                                severity: v.severity === 'High' ? 10 : (v.severity === 'Medium' ? 5 : 1),
                                message: v.message,
                                timestamp: new Date(v.time || v.occurred_at).getTime(),
                                snapshot_url: v.snapshot_url,
                                clip_url: v.clip_url
                            })) : []
                        },
                        evaluationReport: {
                            total_score: rs.total_score,
                            final_verdict: rs.session_status === 'TERMINATED' ? 'TERMINATED' : rs.final_verdict,
                            scoring_basis: rs.scoring_basis,
                            evaluation_logic: rs.session_status === 'TERMINATED' && rs.evaluation_logic
                                ? {
                                    ...rs.evaluation_logic,
                                    executiveSummary: {
                                        ...(rs.evaluation_logic.executiveSummary || {}),
                                        recommendation: 'NOT GENERATED',
                                    }
                                }
                                : rs.evaluation_logic
                        },
                        results: mappedResults
                    } as unknown as InterviewSession;
                });

                const sortedSessions = [...mappedSessions].sort((a, b) => {
                    const dateA = a.date ? new Date(a.date).getTime() : 0;
                    const dateB = b.date ? new Date(b.date).getTime() : 0;
                    return dateB - dateA;
                });
                setSessions(sortedSessions);

                // Auto-trigger background queue worker if any sessions are QUEUED
                if (mappedSessions.some(s => s.status === 'QUEUED')) {
                    supabase.functions.invoke('process-evaluation-queue').catch(() => {});
                }
            }
            // Load Proctoring Settings & Metadata
            const proSettings = await SupabaseService.getSystemSettings('proctoring_settings');
            if (proSettings) {
                setProctorSettings(proSettings);
            }
            const proMeta = await SupabaseService.getSystemSettingsMetadata('proctoring_settings');
            if (proMeta) {
                setProctorMetadata(proMeta);
            }

            // Load Token Stats
            const stats = await SupabaseService.getSystemUsageStats();
            if (stats) {
                setTokenStats(stats);
            }

            // Load Evaluation Mode
            const evalMode = await SupabaseService.getSystemSettings('evaluation_mode');
            if (evalMode === 'LOCAL' || evalMode === 'HYBRID' || evalMode === 'API') {
                setGlobalEvaluationMode(evalMode);
            }

            // Load Drives for assignment dropdown
            const rawDrives = await DriveRepository.listDrives();
            if (rawDrives) {
                setDrives(rawDrives);
            }

            // Load Assignments
            const rawAssignments = await SupabaseService.getAllAssignments();
            if (rawAssignments) {
                setAssignments(rawAssignments);
            }
        } catch (err) {
            console.error("Failed to load sessions, drives or assignments:", err);
            ErrorLogService.logError('system', "Failed to load interview sessions/assignments on admin dashboard", err);
        }

        // Load error logs from service
        setErrorLogs(ErrorLogService.getErrors());
        setIsLoading(false);
    };

    // Load candidate sessions on mount, tab change, demo toggle, and session update events
    useEffect(() => {
        loadSessionsAndErrors();
        const unsubDemo = subscribeDemoMode(() => {
            loadSessionsAndErrors();
        });
        const unsubSession = sessionEvents.on(() => {
            loadSessionsAndErrors();
        });
        return () => {
            unsubDemo();
            unsubSession();
        };
    }, [activeTab]);

    // Load Questions when selectedRole changes
    useEffect(() => {
        setQuestionsFilter('all');
        const loadQuestions = async () => {
            setIsLoading(true);
            try {
                // Try fetching corresponding job post from database
                const jobs = await SupabaseService.getAllJobs();
                const matchedJob = jobs.find(j => 
                    (j.settings as any)?.role === selectedRole ||
                    j.title.toLowerCase().includes(selectedRole.toLowerCase()) || 
                    (selectedRole === 'CSE' && j.title.toLowerCase().includes('computer')) ||
                    (selectedRole === 'ETC' && j.title.toLowerCase().includes('electron')) ||
                    (selectedRole === 'AI' && (j.title.toLowerCase().includes('ai') || j.title.toLowerCase().includes('artificial'))) ||
                    (selectedRole === 'DS' && (j.title.toLowerCase().includes('data') || j.title.toLowerCase().includes('science'))) ||
                    (selectedRole === 'CYBER' && (j.title.toLowerCase().includes('cyber') || j.title.toLowerCase().includes('security'))) ||
                    (selectedRole === 'EE' && (j.title.toLowerCase().includes('electrical') || j.title.toLowerCase().includes('ee'))) ||
                    (selectedRole === 'ME' && (j.title.toLowerCase().includes('mechanical') || j.title.toLowerCase().includes('mech'))) ||
                    (selectedRole === 'CE' && (j.title.toLowerCase().includes('civil') || j.title.toLowerCase().includes('ce'))) ||
                    (selectedRole === 'IT' && (j.title.toLowerCase().includes('information') || j.title.toLowerCase().includes('it')))
                );
                
                if (matchedJob) {
                    if (matchedJob.settings) {
                        setDifficultyStrategy(matchedJob.settings.difficultyStrategy || 'Adaptive');
                        setStageOverrides(matchedJob.settings.stageOverrides || {
                            Fundamentals: 'Adaptive',
                            Core: 'Adaptive',
                            Scenario: 'Adaptive'
                        });
                        const proctor = matchedJob.settings.proctoring;
                        setAiProctoringEnabled(proctor?.enabled !== false && proctor?.aiProctoringEnabled !== false);
                        setCameraMode(proctor?.camera?.mode || proctor?.cameraMode || 'auto');
                    } else {
                        setDifficultyStrategy('Adaptive');
                        setStageOverrides({
                            Fundamentals: 'Adaptive',
                            Core: 'Adaptive',
                            Scenario: 'Adaptive'
                        });
                        setAiProctoringEnabled(true);
                        setCameraMode('auto');
                    }

                    if (matchedJob.questions && matchedJob.questions.length > 0) {
                        const parsed = typeof matchedJob.questions === 'string' ? JSON.parse(matchedJob.questions) : matchedJob.questions;
                        setQuestionsList(parsed);
                        console.log(`Loaded ${parsed.length} questions from database for ${selectedRole}`);
                    } else {
                        const fallback = getQuestionsForRole(selectedRole);
                        setQuestionsList(fallback);
                    }
                } else {
                    // Fallback to local storage or default bank
                    const fallback = getQuestionsForRole(selectedRole);
                    setQuestionsList(fallback);
                    setDifficultyStrategy('Adaptive');
                    setStageOverrides({
                        Fundamentals: 'Adaptive',
                        Core: 'Adaptive',
                        Scenario: 'Adaptive'
                    });
                    setAiProctoringEnabled(true);
                    setCameraMode('auto');
                    console.log(`Loaded ${fallback.length} fallback questions for ${selectedRole}`);
                }
            } catch (err) {
                console.error("Failed to fetch questions:", err);
                const fallback = getQuestionsForRole(selectedRole);
                setQuestionsList(fallback);
                setDifficultyStrategy('Adaptive');
                setStageOverrides({
                    Fundamentals: 'Adaptive',
                    Core: 'Adaptive',
                    Scenario: 'Adaptive'
                });
                setAiProctoringEnabled(true);
                setCameraMode('auto');
            }
            setIsLoading(false);
        };
        loadQuestions();
    }, [selectedRole]);

    // Question bank action: Save custom edits
    const handleSaveQuestions = async () => {
        setIsSaving(true);
        setSuccessMessage(null);
        try {
            // 1. Sync to local storage backup
            localStorage.setItem(`reicrew_questions_${selectedRole.toLowerCase()}`, JSON.stringify(questionsList));
            
            // 2. Sync to Supabase job posts
            const jobs = await SupabaseService.getAllJobs();
            const matchedJob = jobs.find(j => 
                (j.settings as any)?.role === selectedRole ||
                j.title.toLowerCase().includes(selectedRole.toLowerCase()) || 
                (selectedRole === 'CSE' && j.title.toLowerCase().includes('computer')) ||
                (selectedRole === 'ETC' && j.title.toLowerCase().includes('electron'))
            );

            if (matchedJob) {
                const updatedJob: JobPost = {
                    ...matchedJob,
                    questions: questionsList,
                    settings: {
                        ...matchedJob.settings,
                        difficultyStrategy,
                        stageOverrides,
                        proctoring: {
                            ...matchedJob.settings?.proctoring,
                            enabled: aiProctoringEnabled,
                            camera: { mode: cameraMode },
                            aiProctoringEnabled: aiProctoringEnabled,
                            cameraMode: cameraMode
                        }
                    }
                };
                // Sync using existing StorageService or SupabaseService
                await StorageService.saveJobs(jobs.map(j => j.id === matchedJob.id ? updatedJob : j));
                console.log(`Successfully synced edited questions and settings for ${selectedRole} to database`);
            } else {
                console.warn(`No job post found matching ${selectedRole} to sync database questions.`);
            }

            setSuccessMessage("Questions and difficulty settings saved successfully! All future interviews will use this configuration.");
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            console.error("Failed to save questions:", err);
            ErrorLogService.logError('database', `Failed to save questions for ${selectedRole}: ${err.message || err}`, err);
            alert("Failed to save questions to database. Changes saved locally only.");
        } finally {
            setIsSaving(false);
        }
    };

    // Question bank action: Restore default question sets
    const handleResetQuestions = () => {
        if (window.confirm("Are you sure you want to restore the default questions? This will erase all custom edits for this role.")) {
            localStorage.removeItem(`reicrew_questions_${selectedRole.toLowerCase()}`);
            // Re-load questions from defaults
            const defaults = getQuestionsForRole(selectedRole);
            setQuestionsList(defaults);
            setSuccessMessage("Questions reset to default. Click 'Save Changes' to apply this to the database.");
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    };

    // Question bank action: Edit fields inside the list
    const handleUpdateQuestion = (qId: number | string, field: keyof Question, value: any) => {
        const updated = questionsList.map(q => {
            if (q.id === qId) {
                const updatedQ = { ...q, [field]: value };
                return updatedQ;
            }
            return q;
        });
        setQuestionsList(updated);
    };

    // Question bank action: Add new blank question template
    const handleAddQuestion = () => {
        const newQ: Question = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            question: "Enter question text here...",
            difficulty: 'medium',
            type: questionsFilter !== 'all' ? (questionsFilter as any) : 'Core',
            category: "Technical",
            evaluationGuide: ["Explain the core concept or answer the question directly."],
            maxScore: 10
        };
        setQuestionsList([...questionsList, newQ]);
    };

    // Question bank action: Delete question from array
    const handleDeleteQuestion = (qId: number | string) => {
        if (window.confirm("Are you sure you want to delete this question? Remember to click 'Save Changes' to apply the deletion to the database.")) {
            setQuestionsList(questionsList.filter(q => q.id !== qId));
            if (editingQuestion && editingQuestion.id === qId) {
                setEditingQuestion(null);
                setIsAddModalOpen(false);
            }
        }
    };

    // Error log actions
    const handleClearErrorLogs = () => {
        if (window.confirm("Are you sure you want to clear all system error logs?")) {
            ErrorLogService.clearErrors();
            setErrorLogs([]);
            setExpandedErrorId(null);
        }
    };

    const downloadReportPDF = (s: InterviewSession) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Pop-up blocked. Please allow pop-ups to print the report.");
            return;
        }

        const finalVerdictStr = s.evaluationReport?.executiveSummary?.recommendation || s.evaluationReport?.final_verdict || 'PENDING EVALUATION';
        const verdictColor = finalVerdictStr.toUpperCase().includes('STRONG HIRE') || finalVerdictStr.toUpperCase().includes('HIRE') ? '#10B981' : 
                             finalVerdictStr.toUpperCase().includes('BORDERLINE') || finalVerdictStr.toUpperCase().includes('CONSIDER') ? '#F59E0B' : 
                             finalVerdictStr === 'PENDING EVALUATION' ? '#6B7280' : '#EF4444';

        const content = `
            <html>
                <head>
                    <title>Evaluation Report - ${s.candidate.name}</title>
                    <style>
                        body { font-family: 'Inter', system-ui, sans-serif; color: #1E293B; line-height: 1.5; padding: 40px; background: white; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; margin-bottom: 30px; }
                        .title { font-size: 24px; font-weight: 800; color: #0F172A; }
                        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; }
                        .meta-item { background: #F8FAFC; padding: 15px; border-radius: 12px; border: 1px solid #F1F5F9; }
                        .meta-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B; }
                        .meta-val { font-size: 14px; font-weight: 600; color: #334155; margin-top: 4px; }
                        .verdict { font-size: 18px; font-weight: 800; color: ${verdictColor}; }
                        .section-title { font-size: 16px; font-weight: 700; color: #0F172A; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px; }
                        .q-card { background: #FFFFFF; border: 1px solid #E2E8F0; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
                        .q-text { font-weight: 700; font-size: 14px; color: #1E293B; }
                        .ans-text { font-size: 13px; color: #475569; background: #F8FAFC; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 4px solid #6366F1; }
                        .feedback-text { font-size: 13px; color: #475569; margin-top: 10px; font-style: italic; }
                        .score-badge { display: inline-block; padding: 4px 8px; background: #EEF2FF; color: #4F46E5; font-size: 12px; font-weight: 700; border-radius: 6px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="title">REINCREW AI EVALUATION REPORT</div>
                            <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Candidate Assessment Verification</div>
                        </div>
                    </div>

                    <div class="meta-grid">
                        <div class="meta-item">
                            <div class="meta-label">Candidate Name</div>
                            <div class="meta-val">${s.candidate.name}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Email Address</div>
                            <div class="meta-val">${s.candidate.email}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Role Assessment</div>
                            <div class="meta-val">${s.candidate.role}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Conducted On</div>
                            <div class="meta-val">${new Date(s.date).toLocaleString()}</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Overall Evaluation Score</div>
                            <div class="meta-val" style="font-size: 20px; color: #4F46E5;">${Math.round(s.overallScore)}%</div>
                        </div>
                        <div class="meta-item">
                            <div class="meta-label">Final Verdict Recommendation</div>
                            <div class="meta-val verdict">${s.evaluationReport?.executiveSummary?.recommendation || s.evaluationReport?.final_verdict || 'Pending Evaluation'}</div>
                        </div>
                    </div>

                    <div class="section-title">Assessment Question & Responses</div>
                    ${s.results && s.results.length > 0 ? s.results.map((r, i) => `
                        <div class="q-card">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div class="q-text">Q${i+1}: ${r.questionText}</div>
                                <div class="score-badge">Score: ${r.contentScore}/10</div>
                            </div>
                            <div class="ans-text"><strong>Response:</strong> ${r.userAnswer || 'No response provided.'}</div>
                            ${r.feedback ? `<div class="feedback-text"><strong>Evaluator Feedback:</strong> ${formatFeedbackToString(r.feedback)}</div>` : ''}
                        </div>
                    `).join('') : '<p>No question transcripts recorded.</p>'}

                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(() => window.close(), 500);
                        }
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
    };

    // CSV Candidate export helper (restricted to currently filtered sessions!)
    const handleDownloadCSV = () => {
        if (filteredSessions.length === 0) return;
        
        const headers = ['Candidate Name', 'Email', 'Role', 'Date', 'Status', 'Overall Score'];
        const rows = filteredSessions.map(s => [
            s.candidate.name,
            s.candidate.email,
            s.candidate.role,
            new Date(s.date).toLocaleDateString(),
            s.status,
            `${s.overallScore}%`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reicrew_candidates_${filterType}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to evaluate session category flags
    const getSessionCategoryFlags = (s: InterviewSession) => {
        const vm = resolveSessionViewModel(s);
        const score = s.overallScore ?? (s as any).overall_score ?? 0;
        const answersCount = (s as any).questionsAnswered ?? (s as any).questions_answered ?? 0;
        const rawStatus = ((s as any).session_status || s.status || '').toUpperCase();
        const outcome = String((s as any).candidate_outcome || s.evaluationReport?.final_verdict || '').toUpperCase();
        const isShortlisted = outcome.includes('SHORTLIST') || outcome.includes('HIRE');

        const isArchived = Boolean(s.isDeleted);
        const isCompleted = !isArchived && (rawStatus === 'COMPLETED' || vm.effectiveStatus === 'COMPLETED') && (score > 0 || answersCount > 0);
        const isPending = !isArchived && !isCompleted && (rawStatus === 'IN_PROGRESS' || rawStatus === 'CREATED') && answersCount === 0;
        const isQueued = !isArchived && (rawStatus === 'QUEUED' || vm.effectiveStatus === 'QUEUED' || ((s as any).evaluation_logic as any)?.evaluationStatus === 'QUEUED');
        const isFlagged = !isArchived && ((s.proctoringReport?.violations?.length || 0) > 0 || rawStatus === 'TERMINATED' || (score > 0 && score < 50));
        const isError = !isArchived && (rawStatus === 'TERMINATED' || ((s as any).evaluation_logic as any)?.evaluationStatus === 'FAILED' || Boolean((s as any)?.queryFailures?.responses));
        const isApi = !isArchived && vm.evalMode === 'API';
        const isLocal = !isArchived && vm.evalMode === 'LOCAL';
        const isTop = !isArchived && (score >= 70 || isShortlisted);

        return { isArchived, isCompleted, isPending, isQueued, isFlagged, isError, isApi, isLocal, isTop };
    };

    // Calculate dynamic counts for each filter pill
    const filterCounts = useMemo(() => {
        const counts = {
            all: 0,
            completed: 0,
            pending: 0,
            queued: 0,
            flagged: 0,
            errors: 0,
            api: 0,
            local: 0,
            top: 0,
            archived: 0,
        };

        sessions.forEach(s => {
            const query = searchTerm.toLowerCase();
            const matchesSearch = !query || s.candidate.name.toLowerCase().includes(query) || (s.candidate.email && s.candidate.email.toLowerCase().includes(query));
            if (!matchesSearch) return;

            const flags = getSessionCategoryFlags(s);
            if (!flags.isArchived) counts.all++;
            if (flags.isCompleted) counts.completed++;
            if (flags.isPending) counts.pending++;
            if (flags.isQueued) counts.queued++;
            if (flags.isFlagged) counts.flagged++;
            if (flags.isError) counts.errors++;
            if (flags.isApi) counts.api++;
            if (flags.isLocal) counts.local++;
            if (flags.isTop) counts.top++;
            if (flags.isArchived) counts.archived++;
        });

        return counts;
    }, [sessions, searchTerm]);

    // Filters candidate session search
    const filteredSessions = sessions.filter(s => {
        // 1. Search Query
        const query = searchTerm.toLowerCase();
        const matchesSearch = s.candidate.name.toLowerCase().includes(query) ||
                              (s.candidate.email && s.candidate.email.toLowerCase().includes(query));
        if (!matchesSearch) return false;

        // 2. Category Filter
        const flags = getSessionCategoryFlags(s);
        if (filterType === 'archived') {
            if (!flags.isArchived) return false;
        } else {
            if (flags.isArchived) return false;
            if (filterType === 'completed' && !flags.isCompleted) return false;
            if (filterType === 'pending' && !flags.isPending) return false;
            if (filterType === 'queued' && !flags.isQueued) return false;
            if (filterType === 'flagged' && !flags.isFlagged) return false;
            if (filterType === 'errors' && !flags.isError) return false;
            if (filterType === 'api' && !flags.isApi) return false;
            if (filterType === 'local' && !flags.isLocal) return false;
            if (filterType === 'top' && !flags.isTop) return false;
        }

        // 3. Date Range Filter
        if (s.date) {
            const sessionTime = new Date(s.date).getTime();
            const now = Date.now();
            if (dateRangeFilter === '24h') {
                if (now - sessionTime > 24 * 60 * 60 * 1000) return false;
            } else if (dateRangeFilter === '7d') {
                if (now - sessionTime > 7 * 24 * 60 * 60 * 1000) return false;
            } else if (dateRangeFilter === '30d') {
                if (now - sessionTime > 30 * 24 * 60 * 60 * 1000) return false;
            }
        }

        return true;
    });

    // Full multi-layered filtering
    const filteredQuestions = questionsList.filter(q => {
        // Stage/Section filter
        if (questionsFilter !== 'all') {
            if (selectedRole === 'APTITUDE') {
                if (q.category !== questionsFilter) return false;
            } else {
                if (q.type !== questionsFilter) return false;
            }
        }
        // Search query
        if (questionSearchQuery) {
            const query = questionSearchQuery.toLowerCase();
            const textMatch = q.question.toLowerCase().includes(query);
            const categoryMatch = q.category?.toLowerCase().includes(query) || false;
            if (!textMatch && !categoryMatch) return false;
        }
        // Difficulty filter
        if (selectedDifficultyFilter !== 'all' && q.difficulty !== selectedDifficultyFilter) return false;
        // Category filter
        if (selectedCategoryFilter !== 'all' && q.category !== selectedCategoryFilter) return false;

        return true;
    });

    // Pagination calculations
    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentQuestions = filteredQuestions.slice(indexOfFirstItem, indexOfLastItem);

    // Reset page to 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [questionSearchQuery, selectedDifficultyFilter, selectedCategoryFilter, questionsFilter, selectedRole]);

    // Checkbox selection helpers
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedQuestions(currentQuestions.map(q => String(q.id)));
        } else {
            setSelectedQuestions([]);
        }
    };

    const handleSelectQuestion = (qId: string, checked: boolean) => {
        if (checked) {
            setSelectedQuestions([...selectedQuestions, qId]);
        } else {
            setSelectedQuestions(selectedQuestions.filter(id => id !== qId));
        }
    };

    // Bulk actions handler
    const handleBulkAction = (action: string) => {
        if (selectedQuestions.length === 0) {
            alert("No questions selected.");
            return;
        }

        let updated = [...questionsList];
        if (action === 'easy' || action === 'medium' || action === 'hard') {
            updated = questionsList.map(q => {
                if (selectedQuestions.includes(String(q.id))) {
                    return { 
                        ...q, 
                        difficulty: action as any,
                        version: (q.version || 1) + 1,
                        updatedAt: new Date().toISOString()
                    };
                }
                return q;
            });
            setSuccessMessage(`Updated difficulty to ${action} for ${selectedQuestions.length} questions.`);
        } else if (action === 'delete') {
            if (window.confirm(`Are you sure you want to delete the ${selectedQuestions.length} selected questions?`)) {
                updated = questionsList.filter(q => !selectedQuestions.includes(String(q.id)));
                setSuccessMessage(`Deleted ${selectedQuestions.length} questions.`);
            } else {
                return;
            }
        } else if (action === 'category') {
            const newCat = window.prompt("Enter new category name:");
            if (newCat !== null && newCat.trim() !== '') {
                updated = questionsList.map(q => {
                    if (selectedQuestions.includes(String(q.id))) {
                        return { 
                            ...q, 
                            category: newCat.trim(),
                            version: (q.version || 1) + 1,
                            updatedAt: new Date().toISOString()
                        };
                    }
                    return q;
                });
                setSuccessMessage(`Updated category to "${newCat.trim()}" for ${selectedQuestions.length} questions.`);
            } else {
                return;
            }
        }
        setQuestionsList(updated);
        setSelectedQuestions([]);
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    // JSON/CSV Question Exporter
    const handleExportQuestions = (format: 'json' | 'csv') => {
        if (questionsList.length === 0) {
            alert("No questions to export.");
            return;
        }

        if (format === 'json') {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questionsList, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `reicrew_questions_${selectedRole.toLowerCase()}_v${Date.now()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        } else {
            // CSV Format (excluding ideal_answer and topic)
            const headers = ['id', 'question', 'difficulty', 'type', 'category', 'evaluationGuide', 'version', 'updatedAt'];
            const rows = questionsList.map(q => {
                const evaluationGuideStr = q.evaluationGuide 
                    ? q.evaluationGuide.join(';') 
                    : '';
                return [
                    q.id,
                    `"${(q.question || '').replace(/"/g, '""')}"`,
                    q.difficulty || 'medium',
                    q.type || 'Core',
                    q.category || 'Technical',
                    `"${evaluationGuideStr.replace(/"/g, '""')}"`,
                    q.version || 1,
                    q.updatedAt || new Date().toISOString()
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `reicrew_questions_${selectedRole.toLowerCase()}_v${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    };

    // JSON/CSV Question Uploader/Previewer
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setImportFileContent(content);
            processImportPreview(content, file.name.endsWith('.csv') ? 'csv' : 'json');
        };
        reader.readAsText(file);
    };

    const processImportPreview = (content: string, format: 'json' | 'csv') => {
        let parsedList: any[] = [];
        const errorsList: { row: number; msg: string; severity: 'error' | 'warning' }[] = [];
        let validCount = 0;
        let warningsCount = 0;
        let errorsCount = 0;

        try {
            if (format === 'json') {
                const data = JSON.parse(content);
                parsedList = Array.isArray(data) ? data : [data];
            } else {
                // Parse CSV
                const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length < 2) throw new Error("CSV file is empty or missing header row.");
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
                
                const parseCsvRow = (text: string) => {
                    const result = [];
                    let insideQuote = false;
                    let entry = "";
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        if (char === '"') {
                            insideQuote = !insideQuote;
                        } else if (char === ',' && !insideQuote) {
                            result.push(entry.trim());
                            entry = "";
                        } else {
                            entry += char;
                        }
                    }
                    result.push(entry.trim());
                    return result;
                };

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCsvRow(lines[i]);
                    const item: any = {};
                    headers.forEach((h, idx) => {
                        let val = values[idx] || '';
                        val = val.replace(/^["']|["']$/g, '').replace(/""/g, '"');
                        item[h] = val;
                    });
                    parsedList.push(item);
                }
            }
        } catch (e: any) {
            alert("Error parsing file: " + e.message);
            return;
        }

        // Validate each parsed item
        const validatedQuestions = parsedList.map((item, index) => {
            const rowNumber = index + 2;
            const rowErrors: string[] = [];
            const rowWarnings: string[] = [];
            
            const questionText = item.question || item.text || '';
            if (!questionText.trim()) {
                rowErrors.push("Missing question text.");
            }

            let difficulty = String(item.difficulty || '').toLowerCase().trim();
            if (!difficulty) {
                rowErrors.push("Missing difficulty.");
            } else if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
                rowWarnings.push(`Invalid difficulty "${item.difficulty}", defaulting to "medium".`);
                difficulty = 'medium';
            }

            let type = item.type || item.stage || '';
            const validTypes = ['Fundamentals', 'Core', 'Scenario', 'Behavioral Experience', 'Behavioral Situation'];
            if (!type) {
                rowErrors.push("Missing flow stage (type).");
            } else {
                const matchedType = validTypes.find(t => t.toLowerCase() === type.toLowerCase().trim());
                if (!matchedType) {
                    rowErrors.push(`Invalid flow stage "${type}". Must be one of: ${validTypes.join(', ')}`);
                } else {
                    type = matchedType;
                }
            }

            const category = item.category || (type.startsWith('Behavioral') ? 'Behavioral' : 'Technical');

            let evaluationGuide: string[] = [];
            if (item.evaluationGuide) {
                evaluationGuide = String(item.evaluationGuide).split(';').map(part => part.trim()).filter(Boolean);
            } else if (item.keyConcepts) {
                // Backward compatibility: Convert imported keyConcepts
                if (typeof item.keyConcepts === 'string') {
                    evaluationGuide = item.keyConcepts.split(';').map((part: string) => {
                        const [concept] = part.split(':');
                        return (concept || '').trim();
                    }).filter(Boolean);
                } else if (Array.isArray(item.keyConcepts)) {
                    evaluationGuide = item.keyConcepts.map((c: any) => typeof c === 'string' ? c : c.concept || '').filter(Boolean);
                }
            } else if (item.keyPoints) {
                if (typeof item.keyPoints === 'string') {
                    evaluationGuide = item.keyPoints.split(';').map((part: string) => part.trim()).filter(Boolean);
                } else if (Array.isArray(item.keyPoints)) {
                    evaluationGuide = item.keyPoints.filter(Boolean);
                }
            }

            if (evaluationGuide.length === 0) {
                rowWarnings.push("No expected evaluation areas specified.");
                evaluationGuide.push("Explain the core concept or answer the question directly.");
            }

            const isDuplicate = questionsList.some(q => 
                q.question.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === 
                questionText.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
            );
            if (isDuplicate) {
                rowWarnings.push("Potential duplicate: Question text matches an existing question in the bank.");
            }

            const version = item.version ? parseInt(item.version, 10) : 1;
            const updatedAt = item.updatedAt || new Date().toISOString();

            rowErrors.forEach(msg => {
                errorsList.push({ row: rowNumber, msg, severity: 'error' });
                errorsCount++;
            });
            rowWarnings.forEach(msg => {
                errorsList.push({ row: rowNumber, msg, severity: 'warning' });
                warningsCount++;
            });

            const isValid = rowErrors.length === 0;
            if (isValid) validCount++;

            return {
                id: item.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                question: questionText,
                difficulty,
                type,
                category,
                evaluationGuide,
                maxScore: item.maxScore ? parseFloat(item.maxScore) : 10,
                version: isNaN(version) ? 1 : version,
                updatedAt,
                isValid
            };
        });

        setImportPreviewData({
            questions: validatedQuestions,
            validCount,
            errors: errorsList,
            warningsCount,
            errorsCount
        });
    };

    const handleCompleteImport = () => {
        if (!importPreviewData) return;

        const validQuestionsToImport = importPreviewData.questions
            .filter(q => q.isValid)
            .map(({ isValid, ...rest }) => rest as Question);

        if (validQuestionsToImport.length === 0) {
            alert("No valid questions found to import.");
            return;
        }

        if (importMergeStrategy === 'replace') {
            setQuestionsList(validQuestionsToImport);
            setSuccessMessage(`Successfully replaced question bank with ${validQuestionsToImport.length} imported questions.`);
        } else {
            const currentTexts = new Set(questionsList.map(q => q.question.toLowerCase().trim().replace(/[^a-z0-9]/g, '')));
            const filteredNew = validQuestionsToImport.filter(q => 
                !currentTexts.has(q.question.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
            );
            
            setQuestionsList([...questionsList, ...filteredNew]);
            setSuccessMessage(`Successfully appended ${filteredNew.length} new unique questions (skipped ${validQuestionsToImport.length - filteredNew.length} duplicates).`);
        }

        setImportModalOpen(false);
        setImportPreviewData(null);
        setImportFileContent(null);
        setImportFileName('');
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    // Modal Question Editor save handler
    const handleSaveModal = () => {
        if (!editingQuestion) return;
        if (!editingQuestion.question.trim()) {
            alert("Question text cannot be empty.");
            return;
        }

        let validAreas = (editingQuestion.evaluationGuide || []).map(a => a.trim()).filter(Boolean);
        if (selectedRole === 'APTITUDE') {
            if (validAreas.length === 0) {
                validAreas = ["Explain the core concept or select the correct option directly."];
            }
            if (!editingQuestion.options || editingQuestion.options.length < 4 || editingQuestion.options.some(o => !o.trim())) {
                alert("All 4 option fields must be filled out for Aptitude questions.");
                return;
            }
            if (!editingQuestion.answer || !['A', 'B', 'C', 'D'].includes(editingQuestion.answer.toUpperCase())) {
                alert("Please select a valid correct answer (A, B, C, or D).");
                return;
            }
        } else {
            if (validAreas.length === 0) {
                alert("At least one non-empty evaluation checklist area is required.");
                return;
            }
        }

        const updatedQ: Question = {
            ...editingQuestion,
            evaluationGuide: validAreas,
            version: isAddModalOpen ? 1 : (editingQuestion.version || 1) + 1,
            updatedAt: new Date().toISOString()
        };

        if (isAddModalOpen) {
            setQuestionsList([...questionsList, updatedQ]);
            setSuccessMessage("Added new question! Click 'Save Changes' to save to database.");
        } else {
            setQuestionsList(questionsList.map(q => q.id === editingQuestion.id ? updatedQ : q));
            setSuccessMessage("Updated question! Click 'Save Changes' to save to database.");
        }
        setEditingQuestion(null);
        setIsAddModalOpen(false);
        setTimeout(() => setSuccessMessage(null), 5000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingQuestion) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${editingQuestion.id || Math.random().toString(36).substring(2, 9)}_${Date.now()}.${fileExt}`;
            
            if (!supabase) throw new Error("Supabase client is not available.");

            const { data, error: uploadError } = await supabase.storage
                .from('question-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('question-images')
                .getPublicUrl(fileName);

            setEditingQuestion({
                ...editingQuestion,
                imageUrl: publicUrl
            });
            alert("Image uploaded successfully!");
        } catch (error: any) {
            console.error("Error uploading image:", error);
            alert(`Failed to upload image: ${error.message || JSON.stringify(error)}`);
        } finally {
            setIsUploading(false);
        }
    };

    // Filters error logs
    const filteredErrors = errorLogs.filter(err => {
        if (errorsFilter === 'all') return true;
        return err.category === errorsFilter;
    });

    // Count statistics for the flow diagram stages
    const getStageCount = (type: string) => {
        return questionsList.filter(q => q.type === type).length;
    };

    const getInterviewsPerDayData = () => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const counts = last7Days.reduce((acc, dateStr) => {
            acc[dateStr] = 0;
            return acc;
        }, {} as Record<string, number>);

        sessions.forEach(s => {
            if (s.date) {
                const dateStr = new Date(s.date).toISOString().split('T')[0];
                if (counts[dateStr] !== undefined) {
                    counts[dateStr]++;
                }
            }
        });

        return last7Days.map(dateStr => {
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const d = new Date(dateStr);
            const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
            return {
                label,
                count: counts[dateStr]
            };
        });
    };

    const InterviewsChart = () => {
        const data = getInterviewsPerDayData();
        const maxCount = Math.max(...data.map(d => d.count), 1);

        return (
            <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 md:mb-6">Interviews Conducted Per Day (Last 7 Days)</h3>
                <div className="relative h-40 md:h-56 flex items-end border-b border-l border-slate-200 pl-1 md:pl-4 pb-2 gap-1 md:gap-4 overflow-hidden">
                    {data.map((d, index) => {
                        const heightPercent = (d.count / maxCount) * 100;
                        const barHeightPx = Math.max(Math.round((heightPercent / 100) * (window.innerWidth < 768 ? 140 : 200)), d.count > 0 ? 8 : 4);
                        return (
                            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group min-w-0">
                                <div className="relative w-full flex justify-center mb-1">
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-1 bg-slate-900 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                        {d.count} {d.count === 1 ? 'interview' : 'interviews'}
                                    </div>
                                    <div
                                        style={{ height: `${barHeightPx}px` }}
                                        className="w-3/4 md:w-10 bg-indigo-500 bg-linear-to-t from-indigo-600 to-indigo-400 rounded-t transition-all duration-500 hover:from-indigo-500 hover:to-indigo-300 cursor-pointer"
                                    />
                                </div>
                                <span className="text-[7px] md:text-[10px] font-semibold text-slate-500 truncate w-full text-center leading-tight">
                                    <span className="md:hidden">{d.label.split(' ')[1]}</span>{/* Just "9", "10" etc on mobile */}
                                    <span className="hidden md:inline">{d.label}</span>{/* Full "Jul 9" on desktop */}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="h-screen w-screen flex bg-[#F8FAFC] overflow-hidden font-sans text-slate-900 selection:bg-indigo-500/10">
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
                    onClick={() => setSidebarOpen(false)} 
                />
            )}
            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-950 text-slate-300 flex flex-col shrink-0 border-r border-slate-900 shadow-xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
            
                <div className="p-6 flex items-center gap-3 text-white border-b border-slate-900">
                    <Shield className="text-indigo-500 shrink-0" size={28} />
                    <div>
                        <h1 className="font-bold text-lg tracking-tight bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">Reicrew AI</h1>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Admin Portal</p>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1.5">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                        { id: 'candidates', icon: FileText, label: 'Evaluation Reports' },
                        { id: 'questions', icon: BookOpen, label: 'Interview Flow Editor' },
                        { id: 'proctoring', icon: ShieldAlert, label: 'Proctoring Settings' },
                        { id: 'system', icon: Activity, label: 'System Health' },
                        { id: 'errors', icon: AlertTriangle, label: 'Error Logs' }
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => { 
                                setActiveTab(item.id as any); 
                                setSelectedSession(null); 
                            }}
                            data-tour={`admin-${item.id}-nav`}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
                                activeTab === item.id 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                                    : 'hover:bg-slate-900/60 hover:text-white text-slate-400'
                            }`}
                        >
                            <item.icon size={18} className="shrink-0" /> 
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-900 bg-slate-950/50">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-300 text-sm font-medium">
                        <LogOut size={18} className="shrink-0" /> Exit Portal
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 lg:h-20 bg-white border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                         {/* Hamburger - mobile only */}
                        <button 
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-600 active:scale-95"
                            aria-label="Open sidebar"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                            </svg>
                        </button>
                        <h2 className="text-sm lg:text-xl font-bold text-slate-800 tracking-tight truncate max-w-45 lg:max-w-none">
                            {activeTab === 'dashboard' && 'Dashboard Overview'}
                            {activeTab === 'candidates' && (selectedSession ? `Session Report: ${selectedSession.candidate.name}` : 'Evaluation Reports & History')}
                            {activeTab === 'questions' && `Questions & Flow Editor: ${selectedRole}`}
                            {activeTab === 'proctoring' && 'Proctoring Settings'}
                            {activeTab === 'system' && 'Infrastructure & System Health'}
                            {activeTab === 'errors' && 'Error Logs'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <DemoToggleSwitch />
                        <NotificationCenter sessions={sessions} showPipelineAlerts />
                        {selectedSession && activeTab === 'candidates' && (
                            <button 
                                onClick={() => setSelectedSession(null)} 
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                            >
                                ← Back to List
                            </button>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-slate-50/50">
                    
                    {/* TAB 0: DASHBOARD OVERVIEW */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-black text-slate-800">{sessions.filter(s => !s.isDeleted).length}</p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Total Interviews</p>
                                    </div>
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                        <FileText size={24} />
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-black text-slate-800">
                                            {sessions.filter(s => !s.isDeleted && (s.status === 'TERMINATED' || s.proctoringReport?.violations?.length > 0)).length}
                                        </p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Flagged Candidates</p>
                                    </div>
                                    <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                        <AlertTriangle size={24} />
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-3xl font-black text-slate-800">
                                            {sessions.filter(s => !s.isDeleted).length > 0
                                                ? `${Math.round(sessions.filter(s => !s.isDeleted).reduce((acc, s) => acc + s.overallScore, 0) / sessions.filter(s => !s.isDeleted).length)}%`
                                                : '0%'}
                                        </p>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Average Score</p>
                                    </div>
                                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                        <CheckCircle2 size={24} />
                                    </div>
                                </div>
                                <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between overflow-hidden">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm md:text-lg font-black text-emerald-600 uppercase tracking-wide leading-tight">
                                            <span className="hidden sm:inline">Operational</span>
                                            <span className="sm:hidden">Online</span>
                                        </p>
                                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">System Status</p>
                                    </div>
                                    <div className="p-2 md:p-3 bg-teal-50 text-teal-600 rounded-xl shrink-0 ml-2">
                                        <Activity size={18} />
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <InterviewsChart />
                            {adminSummary && <DashboardCharts summary={adminSummary} />}
                        </div>
                    )}

                    {/* TAB 1: EVALUATION REPORTS / SESSION HISTORY */}
                    {activeTab === 'candidates' && !selectedSession && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {/* Dynamic Filters Bar */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    {/* Search */}
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl w-full sm:max-w-xs focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/5 transition-all">
                                        <Search size={18} className="text-slate-400 shrink-0" />
                                        <input
                                            placeholder="Search candidate..."
                                            className="bg-transparent outline-none text-sm w-full text-slate-800 placeholder:text-slate-400"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    
                                    {/* Filter Tabs */}
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                        {[
                                            { id: 'all', label: 'All Reports' },
                                            { id: 'completed', label: 'Completed' },
                                            { id: 'pending', label: 'In Progress / Pending' },
                                            { id: 'queued', label: 'Queued' },
                                            { id: 'flagged', label: 'Flagged' },
                                            { id: 'errors', label: 'Error Reports' },
                                            { id: 'api', label: 'API Mode' },
                                            { id: 'local', label: 'Local Mode' },
                                            { id: 'top', label: 'Top Candidates' },
                                            { id: 'archived', label: 'Archived' }
                                        ].map(f => {
                                            const count = filterCounts[f.id as keyof typeof filterCounts] || 0;
                                            const isActive = filterType === f.id;
                                            return (
                                                <button
                                                    key={f.id}
                                                    onClick={() => setFilterType(f.id as any)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                        isActive 
                                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                                                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                                                    }`}
                                                >
                                                    <span>{f.label}</span>
                                                    <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Date Filter */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date:</span>
                                        <select
                                            value={dateRangeFilter}
                                            onChange={e => setDateRangeFilter(e.target.value as any)}
                                            className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                        >
                                            <option value="all">All Time</option>
                                            <option value="24h">Last 24 Hours</option>
                                            <option value="7d">Last 7 Days</option>
                                            <option value="30d">Last 30 Days</option>
                                        </select>
                                    </div>

                                    {/* Export */}
                                    <button 
                                        onClick={handleDownloadCSV}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm w-full sm:w-auto active:scale-[0.98]"
                                    >
                                        <Download size={14} className="shrink-0" /> EXPORT CSV
                                    </button>
                                </div>
                            </div>

                            <div data-tour="admin-sessions-table" className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden w-full">
                                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 px-4 py-2.5 rounded-xl w-full sm:max-w-md focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/5 transition-all">
                                        <Search size={18} className="text-slate-400 shrink-0" />
                                        <input
                                            placeholder="Search by candidate name or email..."
                                            className="bg-transparent outline-none text-sm w-full text-slate-800 placeholder:text-slate-400"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <button 
                                        onClick={handleDownloadCSV}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-indigo-600 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 active:scale-[0.98]"
                                    >
                                        <Download size={14} className="shrink-0" /> EXPORT ALL DATA
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4">Candidate</th>
                                                <th className="px-6 py-4">Assessment Path</th>
                                                <th className="px-6 py-4">Date Conducted</th>
                                                <th className="px-6 py-4">Overall Score</th>
                                                <th className="px-6 py-4">Eval Mode</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredSessions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-10 text-center text-slate-400 font-medium bg-slate-50/20">
                                                        No candidate interview sessions found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredSessions.map((s) => {
                                                    const vm = resolveSessionViewModel(s);
                                                    return (
                                                    <tr key={s.id} className="hover:bg-slate-50/40 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div 
                                                                onClick={() => setSelectedSession(s)}
                                                                className="font-semibold text-slate-800 hover:text-indigo-600 cursor-pointer transition-colors hover:underline"
                                                                title="Click to view report"
                                                            >
                                                                {s.candidate.name}
                                                            </div>
                                                            <div className="text-xs text-slate-400 mt-0.5">{s.candidate.email}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                                            {s.candidate.role}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500">
                                                            {new Date(s.date).toLocaleDateString()} at {new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`font-bold text-base ${
                                                                vm.isUnattempted ? 'text-slate-400' :
                                                                s.overallScore >= 75 ? 'text-emerald-600' : s.overallScore >= 50 ? 'text-amber-600' : 'text-rose-600'
                                                            }`}>
                                                                {vm.displayScoreText}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span
                                                              title={vm.evalMode === 'UNKNOWN' ? 'Evaluation mode was not recorded for this session.' : undefined}
                                                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                                                vm.evalMode === 'API' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                vm.evalMode === 'HYBRID' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                                vm.evalMode === 'LOCAL' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                                                'bg-white text-slate-400 border-slate-200'
                                                            }`}>
                                                                {vm.evalMode === 'UNKNOWN' ? SCORE_PLACEHOLDER : vm.evalMode}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${
                                                                vm.effectiveStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                vm.effectiveStatus === 'TERMINATED' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                                vm.effectiveStatus === 'QUEUED' ? 'bg-blue-50 text-blue-700 border border-blue-100 animate-pulse' :
                                                                (s as any).questionsAnswered || (s as any).questions_answered || 0 === 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                                'bg-amber-50 text-amber-700 border border-amber-100'
                                                            }`}>
                                                                {vm.effectiveStatus === 'IN_PROGRESS' && ((s as any).questionsAnswered || (s as any).questions_answered || 0) === 0 ? 'IN PROGRESS (UNANSWERED)' : vm.displayStatusText}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right relative">
                                                            <div className="inline-block text-left">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveDropdownId(activeDropdownId === s.id ? null : s.id);
                                                                    }}
                                                                    className="p-2 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 bg-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                                                                >
                                                                    <MoreVertical size={16} />
                                                                </button>
                                                                {activeDropdownId === s.id && (
                                                                    <>
                                                                        <div 
                                                                            className="fixed inset-0 z-10" 
                                                                            onClick={() => setActiveDropdownId(null)}
                                                                        />
                                                                        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-slate-200 py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                                                                            {!s.isDeleted ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSelectedSession(s);
                                                                                            setActiveDropdownId(null);
                                                                                        }}
                                                                                        className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                                                                                    >
                                                                                        <FileText size={14} className="text-slate-400" /> View Session Report
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            downloadReportPDF(s);
                                                                                            setActiveDropdownId(null);
                                                                                        }}
                                                                                        className="w-full px-4 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                                                                    >
                                                                                        <Download size={14} /> Download PDF
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSessionToConfirm(s);
                                                                                            setShowConfirmModal('archive');
                                                                                            setActiveDropdownId(null);
                                                                                        }}
                                                                                        className="w-full px-4 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                                                                                    >
                                                                                        <Archive size={14} /> Archive Report
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSessionToConfirm(s);
                                                                                            setShowConfirmModal('restore');
                                                                                            setActiveDropdownId(null);
                                                                                        }}
                                                                                        className="w-full px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                                                                    >
                                                                                        <RefreshCw size={14} /> Restore Report
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setSessionToConfirm(s);
                                                                                            setShowConfirmModal('delete');
                                                                                            setActiveDropdownId(null);
                                                                                        }}
                                                                                        className="w-full px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                                                                                    >
                                                                                        <Trash2 size={14} /> Permanent Delete
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ); })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'candidates' && selectedSession && (
                        <div className="space-y-6 animate-in fade-in duration-300 pb-10">
                            {(() => {
                                const report = getEffectiveSessionReport(selectedSession);
                                if (report && !(report as any)?._isMissingData) {
                                    return (
                                        <SessionReportView
                                            candidate={{
                                                name: selectedSession.candidate.name || '',
                                                email: selectedSession.candidate.email || '',
                                                role: selectedSession.candidate.role || '',
                                                session: selectedSession
                                            }}
                                            evalReport={report}
                                            sessionId={selectedSession.id}
                                            mode="admin"
                                        />
                                    );
                                }

                                return (
                                    <div className="bg-white p-8 border border-slate-200 rounded-3xl shadow-sm max-w-xl mx-auto mt-6 space-y-6 animate-in fade-in duration-300">
                                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 font-extrabold text-lg">
                                                !
                                            </div>
                                            <div className="text-left">
                                                <h3 className="font-extrabold text-slate-900 text-lg">No Questions Answered</h3>
                                                <p className="text-slate-500 text-xs mt-0.5">Candidate initialized session but exited before answering.</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-2 text-left text-xs text-slate-600">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Candidate Name:</span>
                                                <span className="font-bold text-slate-800">{selectedSession.candidate.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Email Address:</span>
                                                <span className="font-bold text-slate-800">{selectedSession.candidate.email || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Assessment Domain:</span>
                                                <span className="font-bold text-slate-800">{selectedSession.candidate.role}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Date Conducted:</span>
                                                <span className="font-bold text-slate-800">{new Date(selectedSession.date).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Session Status:</span>
                                                <span className="font-black text-rose-600 uppercase">{selectedSession.status}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400 font-medium">Proctoring Events:</span>
                                                <span className="font-bold text-slate-800">{selectedSession.proctoringReport?.violations?.length || 0} event(s) logged</span>
                                            </div>
                                        </div>

                                        <div className="text-left bg-blue-50/60 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900 leading-relaxed font-medium">
                                            💡 <strong>Session Note:</strong> The candidate opened the interview screen, but closed or exited the browser window before recording answers to any question. No score could be calculated for this session.
                                        </div>

                                        <button 
                                            onClick={() => setSelectedSession(null)} 
                                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                                        >
                                            Return to Sessions Table
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* TAB 2: INTERVIEW FLOW & QUESTION EDITOR */}
                    {activeTab === 'questions' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
                            {/* Domain Selection */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-bold text-slate-800 text-base sm:text-lg">Question Bank Selection</h3>
                                    <p className="text-xs text-slate-400">Choose the technical domain questions to edit.</p>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center w-full sm:w-auto">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Domain:</span>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => { setSelectedRole(e.target.value as any); setQuestionsFilter('all'); }}
                                        className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-slate-900 px-3 sm:px-4 py-2.5 rounded-xl outline-none focus:border-indigo-500 text-xs font-black uppercase tracking-wider cursor-pointer transition-all min-w-50 sm:min-w-62.5"
                                    >
                                        {Object.entries(InterviewRoles).map(([code, name]) => (
                                            <option key={code} value={code}>{name}</option>
                                        ))}
                                        <option value="APTITUDE">Aptitude Test</option>
                                    </select>
                                </div>
                            </div>

                            {/* SUB-TAB SYSTEM FOR RECRUITER FOCUS */}
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-md shadow-sm">
                                <button
                                    onClick={() => setQuestionsSubTab('editor')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                        questionsSubTab === 'editor' 
                                            ? 'bg-white text-indigo-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Questions
                                </button>
                                <button
                                    onClick={() => setQuestionsSubTab('settings')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                        questionsSubTab === 'settings' 
                                            ? 'bg-white text-indigo-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Interview Settings
                                </button>
                                <button
                                    onClick={() => setQuestionsSubTab('analytics')}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                                        questionsSubTab === 'analytics' 
                                            ? 'bg-white text-indigo-600 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Analytics
                                </button>
                            </div>

                            {/* SUB-TAB CONTENT 1: QUESTIONS EDITOR */}
                            {questionsSubTab === 'editor' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    {/* DYNAMIC INTERVIEW FLOW CHART */}
                                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                <Sliders size={20} className="text-indigo-500" /> {selectedRole === 'APTITUDE' ? 'Active Aptitude Test Section Flow' : 'Active Adaptive Interview Flow'}
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {selectedRole === 'APTITUDE'
                                                    ? 'Click on any section in the path below to filter and edit its questions.'
                                                    : 'Click on any stage in the path below to filter and edit its questions.'}
                                            </p>
                                            {/*
                                              * States the real interview length instead of implying a fixed one.
                                              *
                                              * The stage cards below are question TYPE groups used to filter the bank —
                                              * they are not the interview's length. Each card carried a hardcoded
                                              * "Q1 of 5" … "Q5 of 5" badge, which read as "this interview asks five
                                              * questions". The default template has ten steps, and a job post that
                                              * defines its own question set produces one step per selected question
                                              * (composeInterviewFromList, up to 20). So the badge was wrong for the
                                              * default flow and wrong again for every custom flow.
                                              */}
                                            {selectedRole !== 'APTITUDE' && (
                                                <p className="text-xs text-slate-500">
                                                    The default adaptive flow asks{' '}
                                                    <span className="font-bold text-indigo-600">{DEFAULT_FLOW_QUESTION_COUNT} questions</span>.
                                                    A job post with its own selected questions overrides this and asks one question per
                                                    selection, so the number varies per interview.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col xl:flex-row items-stretch gap-3 pt-4">
                                            {selectedRole === 'APTITUDE' ? (
                                                <>
                                                    {/* Section 1: Quantitative */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Quantitative')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Quantitative' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Section 1</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Quantitative</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Numerical and mathematical reasoning.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Part 1</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.category === 'Quantitative').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Section 2: Logical */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Logical')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Logical' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Section 2</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Logical Reasoning</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Pattern recognition and logical deduction.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Part 2</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.category === 'Logical').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Section 3: Analytical */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Analytical')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Analytical' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Section 3</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Analytical Ability</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Data interpretation and critical thinking.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Part 3</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.category === 'Analytical').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Section 4: Verbal */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Verbal')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Verbal' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Section 4</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Verbal Ability</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">English language and comprehension.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Part 4</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.category === 'Verbal').length} Qs</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Stage 1 */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Fundamentals')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Fundamentals' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Stage 1</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Fundamentals</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Basic concepts & entry-level questions.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Stage 1 of {ADAPTIVE_STAGE_COUNT}</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.type === 'Fundamentals').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Stage 2 */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Core')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Core' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Stage 2</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Core Tech (Adaptive)</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Core details; splits dynamically by difficulty.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Stage 2 of {ADAPTIVE_STAGE_COUNT}</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.type === 'Core').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Stage 3 */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Scenario')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Scenario' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Stage 3</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Scenario/Case Study</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Practical problem solving scenario.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Stage 3 of {ADAPTIVE_STAGE_COUNT}</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.type === 'Scenario').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Stage 4 */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Behavioral Experience')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Behavioral Experience' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Stage 4</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Behavioral Exp</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Evaluates past candidate experience.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Stage 4 of {ADAPTIVE_STAGE_COUNT}</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.type === 'Behavioral Experience').length} Qs</span>
                                                        </div>
                                                    </div>

                                                    {/* Arrow */}
                                                    <div className="hidden xl:flex items-center text-slate-300">→</div>

                                                    {/* Stage 5 */}
                                                    <div 
                                                        onClick={() => setQuestionsFilter('Behavioral Situation')}
                                                        className={`flex-1 p-5 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                                                            questionsFilter === 'Behavioral Situation' 
                                                                ? 'bg-indigo-50/70 border-indigo-500 shadow-md ring-2 ring-indigo-500/5' 
                                                                : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Stage 5</span>
                                                            <h4 className="font-bold text-sm text-slate-800 mt-1">Behavioral Situation</h4>
                                                            <p className="text-[11px] text-slate-400 mt-1">Evaluates scenario-based behavior.</p>
                                                        </div>
                                                        <div className="mt-4 flex items-center justify-between">
                                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Stage 5 of {ADAPTIVE_STAGE_COUNT}</span>
                                                            <span className="text-xs font-black text-slate-500">{questionsList.filter(q => q.type === 'Behavioral Situation').length} Qs</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {questionsFilter !== 'all' && (
                                            <div className="flex justify-end pt-2">
                                                <button 
                                                    onClick={() => setQuestionsFilter('all')}
                                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                                                >
                                                    View All Questions in Bank ({questionsList.length}) →
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* SEARCH, FILTERS & BULK ACTIONS ROW */}
                                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                            <div className="flex flex-wrap items-center gap-3 flex-1">
                                                {/* Search */}
                                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-2 rounded-xl w-full sm:max-w-xs focus-within:bg-white focus-within:border-indigo-500 transition-all">
                                                    <Search size={16} className="text-slate-400 shrink-0" />
                                                    <input
                                                        placeholder="Search question text..."
                                                        className="bg-transparent outline-none text-xs w-full text-slate-800 placeholder:text-slate-400"
                                                        value={questionSearchQuery}
                                                        onChange={e => setQuestionSearchQuery(e.target.value)}
                                                    />
                                                </div>

                                                {/* Difficulty Filter */}
                                                <select
                                                    value={selectedDifficultyFilter}
                                                    onChange={e => setSelectedDifficultyFilter(e.target.value)}
                                                    className="border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none bg-white text-slate-700 font-semibold shadow-sm"
                                                >
                                                    <option value="all">All Difficulties</option>
                                                    <option value="easy">Easy Only</option>
                                                    <option value="medium">Medium Only</option>
                                                    <option value="hard">Hard Only</option>
                                                </select>

                                                {/* Category Filter */}
                                                <select
                                                    value={selectedCategoryFilter}
                                                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                                                    className="border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs outline-none bg-white text-slate-700 font-semibold shadow-sm"
                                                >
                                                    <option value="all">All Categories</option>
                                                    {Array.from(new Set(questionsList.map(q => q.category).filter(Boolean))).map(cat => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>

                                                {/* Stage Type filter info indicator */}
                                                {questionsFilter !== 'all' && (
                                                    <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
                                                        {selectedRole === 'APTITUDE' ? 'Section' : 'Stage'}: {questionsFilter}
                                                        <button onClick={() => setQuestionsFilter('all')} className="text-indigo-400 hover:text-indigo-700 font-black">✕</button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons: Import, Export, Add, Save */}
                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                <button 
                                                    onClick={() => handleExportQuestions('csv')}
                                                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                                                >
                                                    <Download size={14} /> Export CSV
                                                </button>
                                                <button 
                                                    onClick={() => { setImportPreviewData(null); setImportModalOpen(true); }}
                                                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm"
                                                >
                                                    <Plus size={14} className="rotate-45" /> Import CSV/JSON
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const newQ: Question = selectedRole === 'APTITUDE' ? {
                                                            id: `apt-custom-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                                                            question: "",
                                                            difficulty: 'medium',
                                                            type: 'Fundamentals',
                                                            category: questionsFilter !== 'all' ? questionsFilter : "Quantitative",
                                                            options: ["", "", "", ""],
                                                            answer: "A",
                                                            explanation: "",
                                                            evaluationGuide: ["Explain the core concept or select the correct option directly."],
                                                            maxScore: 10,
                                                            version: 1,
                                                            updatedAt: new Date().toISOString()
                                                        } : {
                                                            id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                                                            question: "",
                                                            difficulty: 'medium',
                                                            type: questionsFilter !== 'all' ? (questionsFilter as any) : 'Core',
                                                            category: "Technical",
                                                            evaluationGuide: ["Core Concept"],
                                                            maxScore: 10,
                                                            version: 1,
                                                            updatedAt: new Date().toISOString()
                                                        };
                                                        setEditingQuestion(newQ);
                                                        setIsAddModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                                                >
                                                    <Plus size={14} /> Add Question
                                                </button>
                                                <button
                                                    onClick={handleSaveQuestions}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98]"
                                                >
                                                    <Save size={14} /> {isSaving ? "Saving..." : "Save Changes"}
                                                </button>
                                            </div>
                                        </div>

                                        {/* BULK ACTIONS SELECTOR */}
                                        {selectedQuestions.length > 0 && (
                                            <div className="flex items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                                                <span className="text-xs font-bold text-indigo-800">{selectedQuestions.length} questions selected:</span>
                                                <select
                                                    onChange={(e) => {
                                                        const act = e.target.value;
                                                        if (!act) return;
                                                        handleBulkAction(act);
                                                        e.target.value = '';
                                                    }}
                                                    className="border border-indigo-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs outline-none bg-white text-indigo-700 font-bold shadow-sm"
                                                >
                                                    <option value="">Choose Bulk Action...</option>
                                                    <option value="easy">Set Difficulty to Easy</option>
                                                    <option value="medium">Set Difficulty to Medium</option>
                                                    <option value="hard">Set Difficulty to Hard</option>
                                                    <option value="category">Change Category...</option>
                                                    <option value="delete">Delete Selected Questions</option>
                                                </select>
                                                <button 
                                                    onClick={() => setSelectedQuestions([])} 
                                                    className="text-xs text-slate-400 hover:text-indigo-800 hover:underline font-bold"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* QUESTIONS TABLE */}
                                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
                                        <div className="overflow-x-auto">

                                            {/* Mobile: Card view */}
                                            <div className="block md:hidden divide-y divide-slate-100">
                                                {filteredQuestions.length === 0 ? (
                                                    <div className="px-6 py-12 text-center text-slate-400 font-semibold">
                                                        No questions matched the active filters.
                                                    </div>
                                                ) : (
                                                    currentQuestions.map((q) => {
                                                        const isChecked = selectedQuestions.includes(String(q.id));
                                                        return (
                                                            <div key={q.id} className={`p-4 ${isChecked ? 'bg-indigo-50/10' : ''}`}>
                                                                <div className="flex items-start gap-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => handleSelectQuestion(String(q.id), e.target.checked)}
                                                                        className="accent-indigo-600 rounded border-slate-300 w-4 h-4 cursor-pointer mt-1 shrink-0"
                                                                    />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-semibold text-slate-800 text-sm leading-snug line-clamp-3">
                                                                            {q.question}
                                                                        </p>
                                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                            <span className="text-xs text-slate-500 font-medium">
                                                                                {selectedRole === 'APTITUDE' ? q.category : q.type}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                                                                                q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                                q.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                                                'bg-rose-50 text-rose-700 border border-rose-100'
                                                                            }`}>
                                                                                {q.difficulty}
                                                                            </span>
                                                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-md">
                                                                                {q.evaluationGuide?.length || 0} Areas
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <button
                                                                            onClick={() => { setEditingQuestion({ ...q }); setIsAddModalOpen(false); }}
                                                                            className="p-1.5 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 bg-white rounded-lg text-slate-500 transition-all shadow-sm"
                                                                        >
                                                                            <Edit size={13} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteQuestion(q.id)}
                                                                            className="p-1.5 border border-slate-200 hover:border-red-500 hover:text-red-600 bg-white rounded-lg text-slate-500 transition-all shadow-sm"
                                                                        >
                                                                            <Trash2 size={13} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            <table className="hidden md:table w-full text-left text-sm whitespace-nowrap table-fixed">
                                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-4 w-12 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={filteredQuestions.length > 0 && currentQuestions.every(q => selectedQuestions.includes(String(q.id)))}
                                                                onChange={handleSelectAll}
                                                                className="accent-indigo-600 rounded border-slate-300 w-4 h-4 cursor-pointer"
                                                            />
                                                        </th>
                                                        <th className="px-6 py-4 w-[60%]">Question</th>
                                                        <th className="px-6 py-4 w-36">{selectedRole === 'APTITUDE' ? 'Section' : 'Stage'}</th>
                                                        <th className="px-6 py-4 w-28">Difficulty</th>
                                                        <th className="px-6 py-4 w-28 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredQuestions.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-semibold bg-slate-50/20">
                                                                No questions matched the active filters.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        currentQuestions.map((q) => {
                                                            const isChecked = selectedQuestions.includes(String(q.id));
                                                            return (
                                                                <tr key={q.id} className={`hover:bg-slate-50/30 transition-colors ${isChecked ? 'bg-indigo-50/10' : ''}`}>
                                                                    <td className="px-6 py-4 text-center">
                                                                        <input 
                                                                            type="checkbox" 
                                                                            checked={isChecked}
                                                                            onChange={(e) => handleSelectQuestion(String(q.id), e.target.checked)}
                                                                            className="accent-indigo-600 rounded border-slate-300 w-4 h-4 cursor-pointer"
                                                                        />
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-semibold text-slate-800 truncate" title={q.question}>
                                                                                {q.question}
                                                                            </span>
                                                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 rounded-md shrink-0">
                                                                                {q.evaluationGuide?.length || 0} Areas
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="text-xs text-slate-600 font-medium">{selectedRole === 'APTITUDE' ? q.category : q.type}</span>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                                                                            q.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                            q.difficulty === 'medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                                            'bg-rose-50 text-rose-700 border border-rose-100'
                                                                        }`}>
                                                                            {q.difficulty}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4 text-right">
                                                                        <div className="flex items-center justify-end gap-1">
                                                                            <button 
                                                                                onClick={() => { setEditingQuestion({ ...q }); setIsAddModalOpen(false); }} 
                                                                                className="p-1.5 border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 bg-white rounded-lg text-slate-500 transition-all shadow-sm"
                                                                                title="Edit Details"
                                                                            >
                                                                                <Edit size={13} />
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDeleteQuestion(q.id)} 
                                                                                className="p-1.5 border border-slate-200 hover:border-red-500 hover:text-red-600 bg-white rounded-lg text-slate-500 transition-all shadow-sm"
                                                                                title="Delete Question"
                                                                            >
                                                                                <Trash2 size={13} />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* PAGINATION FOOTER */}
                                        {totalPages > 1 && (
                                        <div className="p-3 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                                            <div className="text-[10px] sm:text-xs text-slate-400 font-semibold text-center sm:text-left">
                                            Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredQuestions.length)} of {filteredQuestions.length} questions
                                            </div>
                                            <div className="flex items-center gap-1 flex-wrap justify-center">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="px-2 sm:px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] sm:text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none min-w-15 sm:min-w-20"
                                            >
                                                <span className="sm:hidden">Prev</span>
                                                <span className="hidden sm:inline">&lt; Previous</span>
                                            </button>
                                            
                                            {/* Show limited page numbers on mobile */}
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                                // On mobile, only show current page and 2 neighbors
                                                const showOnMobile = totalPages <= 5 || 
                                                page === currentPage || 
                                                page === currentPage - 1 || 
                                                page === currentPage + 1;
                                                
                                                if (!showOnMobile) return null;
                                                
                                                // Add ellipsis for skipped pages
                                                const prevPage = page > 1 ? Array.from({ length: totalPages }, (_, i) => i + 1)[page - 2] : null;
                                                if (prevPage && page - prevPage > 1 && showOnMobile) {
                                                return (
                                                    <React.Fragment key={`ellipsis-${page}`}>
                                                    <span className="px-1 text-xs text-slate-400 hidden sm:inline">...</span>
                                                    </React.Fragment>
                                                );
                                                }
                                                
                                                return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 sm:w-auto sm:h-auto px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg min-w-8 ${
                                                    currentPage === page
                                                        ? 'bg-indigo-600 text-white shadow-sm'
                                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                                );
                                            })}
                                            
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="px-2 sm:px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] sm:text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none min-w-15 sm:min-w-20"
                                            >
                                                <span className="sm:hidden">Next</span>
                                                <span className="hidden sm:inline">Next &gt;</span>
                                            </button>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* SUB-TAB CONTENT 2: INTERVIEW SETTINGS */}
                            {questionsSubTab === 'settings' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                                        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                    <Sliders size={20} className="text-indigo-500" /> Recruiter Strategy & Difficulty Overrides
                                                </h3>
                                                <p className="text-xs text-slate-400">Configure how the AI-driven assessment adjusts difficulty levels for each candidate.</p>
                                            </div>
                                            <button
                                                onClick={handleSaveQuestions}
                                                disabled={isSaving}
                                                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98]"
                                            >
                                                <Save size={14} /> {isSaving ? "Saving Settings..." : "Save Settings"}
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                            <div className="space-y-2 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Global Difficulty Strategy</label>
                                                <p className="text-[11px] text-slate-400 mb-2">Base strategy for selecting questions in technical stages.</p>
                                                <select
                                                    value={difficultyStrategy}
                                                    onChange={(e) => setDifficultyStrategy(e.target.value as any)}
                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-xs outline-none bg-white text-slate-700 font-bold shadow-sm transition-all"
                                                >
                                                    <option value="Adaptive">Adaptive (Dynamic Difficulty based on candidate answers)</option>
                                                    <option value="Easy Only">Easy Only (Beginner hiring)</option>
                                                    <option value="Medium Only">Medium Only (Mid-level hiring)</option>
                                                    <option value="Hard Only">Hard Only (Senior / Advanced)</option>
                                                </select>
                                            </div>
                                            {/* ─── GLOBAL EVALUATION ENGINE MODE ─── */}
<div className="space-y-3 p-5 bg-slate-50/50 rounded-2xl border border-slate-100 md:col-span-2">
  <div className="flex justify-between items-center">
    <div>
      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Global Evaluation Engine Mode</label>
      <p className="text-[11px] text-slate-400 mt-1">Controls the grading architecture for all interviews. <strong>Hybrid</strong> queues AI evaluation in the background (1 API call).</p>
    </div>
    {modeSuccessMsg && (
      <span className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200/40 px-2.5 py-1 rounded-lg font-semibold animate-in fade-in duration-200">
        ✓ {modeSuccessMsg}
      </span>
    )}
  </div>
  
  <div className="grid grid-cols-3 gap-3 mt-2">
    {([
      { id: 'API', label: 'API Mode', desc: 'Real-time AI Eval' },
      { id: 'LOCAL', label: 'Local Mode', desc: 'Zero Cost / Instant' },
      { id: 'HYBRID', label: 'Hybrid Mode', desc: 'Queued AI (1 Call)' }
    ] as const).map((m) => (
      <button
        key={m.id}
        onClick={() => handleSaveEvaluationMode(m.id)}
        disabled={isSavingMode}
        className={`p-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 active:scale-[0.98] ${
          globalEvaluationMode === m.id
            ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 shadow-sm font-black'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span className="text-xs">{m.label}</span>
        <span className="text-[9px] font-normal text-slate-400 text-center">{m.desc}</span>
      </button>
    ))}
  </div>
</div>

                                            <div className="space-y-2 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Stage 1: Fundamentals Override</label>
                                                <p className="text-[11px] text-slate-400 mb-2">Override difficulty choice specifically for basic concepts.</p>
                                                <select
                                                    value={stageOverrides.Fundamentals || 'Adaptive'}
                                                    onChange={(e) => setStageOverrides({ ...stageOverrides, Fundamentals: e.target.value as any })}
                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-xs outline-none bg-white text-slate-700 font-bold shadow-sm transition-all"
                                                >
                                                    <option value="Adaptive">Fallback to Global Strategy</option>
                                                    <option value="Easy Only">Easy Only</option>
                                                    <option value="Medium Only">Medium Only</option>
                                                    <option value="Hard Only">Hard Only</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Stage 2: Core Tech Override</label>
                                                <p className="text-[11px] text-slate-400 mb-2">Override difficulty choice specifically for main technical concepts.</p>
                                                <select
                                                    value={stageOverrides.Core || 'Adaptive'}
                                                    onChange={(e) => setStageOverrides({ ...stageOverrides, Core: e.target.value as any })}
                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-xs outline-none bg-white text-slate-700 font-bold shadow-sm transition-all"
                                                >
                                                    <option value="Adaptive">Fallback to Global Strategy</option>
                                                    <option value="Easy Only">Easy Only</option>
                                                    <option value="Medium Only">Medium Only</option>
                                                    <option value="Hard Only">Hard Only</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Stage 3: Scenario Override</label>
                                                <p className="text-[11px] text-slate-400 mb-2">Override difficulty choice specifically for situational case studies.</p>
                                                <select
                                                    value={stageOverrides.Scenario || 'Adaptive'}
                                                    onChange={(e) => setStageOverrides({ ...stageOverrides, Scenario: e.target.value as any })}
                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-xs outline-none bg-white text-slate-700 font-bold shadow-sm transition-all"
                                                >
                                                    <option value="Adaptive">Fallback to Global Strategy</option>
                                                    <option value="Easy Only">Easy Only</option>
                                                    <option value="Medium Only">Medium Only</option>
                                                    <option value="Hard Only">Hard Only</option>
                                                </select>
                                            </div>

                                            {/* Proctoring & Camera Rules */}
                                            <div className="border-t border-slate-100 pt-6 space-y-4 md:col-span-2">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                        <ShieldAlert size={18} className="text-indigo-500" /> Proctoring & Camera Rules
                                                    </h4>
                                                    <p className="text-[11px] text-slate-400">Configure whether candidate session proctoring is enabled and which camera device to enforce.</p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                                    {/* Enable/Disable Proctoring */}
                                                    <div className="space-y-3 p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                                                        <div>
                                                            <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">AI Proctoring Policy</label>
                                                            <p className="text-[11px] text-slate-400 mb-2">Enable or disable anti-cheat event detection for this role.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer mt-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={aiProctoringEnabled}
                                                                onChange={(e) => setAiProctoringEnabled(e.target.checked)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                            <span className="ml-3 text-xs font-bold text-slate-750">
                                                                {aiProctoringEnabled ? "AI Proctoring Enabled" : "Proctoring Disabled"}
                                                            </span>
                                                        </label>
                                                    </div>

                                                    {/* Camera Source Selector */}
                                                    <div className="space-y-3 p-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Enforced Camera Source</label>
                                                        <p className="text-[11px] text-slate-400 mb-2">Determine the primary recording hardware required of candidates.</p>
                                                        <div className="flex flex-col gap-2 mt-1">
                                                            <label className="inline-flex items-center text-xs font-bold text-slate-750 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="cameraMode"
                                                                    value="auto"
                                                                    checked={cameraMode === 'auto'}
                                                                    onChange={() => setCameraMode('auto')}
                                                                    className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                                    disabled={!aiProctoringEnabled}
                                                                />
                                                                <span className="ml-2">Auto Detect (Webcam first, fallback to Phone)</span>
                                                            </label>
                                                            <label className="inline-flex items-center text-xs font-bold text-slate-750 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="cameraMode"
                                                                    value="webcam"
                                                                    checked={cameraMode === 'webcam'}
                                                                    onChange={() => setCameraMode('webcam')}
                                                                    className="text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                                                                    disabled={!aiProctoringEnabled}
                                                                />
                                                                <span className="ml-2">Desktop Webcam Only</span>
                                                            </label>
                                                            <label className="inline-flex items-center text-xs font-bold text-slate-750 cursor-pointer">
                                                                <input
                                                                    type="radio"
                                                                    name="cameraMode"
                                                                    value="phone"
                                                                    checked={cameraMode === 'phone'}
                                                                    onChange={() => setCameraMode('phone')}
                                                                    className="text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                                                                    disabled={!aiProctoringEnabled}
                                                                />
                                                                <span className="ml-2">Phone Camera Only</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 space-y-2 mt-4">
                                            <p className="font-bold flex items-center gap-1"><AlertTriangle size={14} className="text-indigo-500" /> Precedence Rule & Behavior</p>
                                            <ol className="list-decimal pl-4 space-y-1 text-slate-400 font-medium">
                                                <li>Individual Stage Override &gt; Global Strategy &gt; Default Adaptive.</li>
                                                <li>Stage 4 (Behavioral Experience) and Stage 5 (Behavioral Situation) do not support overrides as they evaluate dynamic behavioral factors without explicit easy/medium/hard question classification.</li>
                                            </ol>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SUB-TAB CONTENT 3: ANALYTICS & BALANCING */}
                            {questionsSubTab === 'analytics' && (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                                <Activity size={20} className="text-indigo-500" /> Question Bank Coverage Analytics & Balancing
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {selectedRole === 'APTITUDE' 
                                                    ? 'View overall question distribution across aptitude sections and difficulty skewness.' 
                                                    : 'View overall question distribution across interview stages and difficulty skewness.'}
                                            </p>
                                        </div>

                                        {selectedRole === 'APTITUDE' ? (
                                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total Questions</div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.category === 'Quantitative').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Quantitative</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.category === 'Quantitative' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.category === 'Quantitative' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.category === 'Quantitative' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.category === 'Logical').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Logical</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.category === 'Logical' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.category === 'Logical' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.category === 'Logical' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.category === 'Analytical').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Analytical</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.category === 'Analytical' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.category === 'Analytical' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.category === 'Analytical' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.category === 'Verbal').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Verbal</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.category === 'Verbal' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.category === 'Verbal' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.category === 'Verbal' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Total Questions</div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.type === 'Fundamentals').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Fundamentals</div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.type === 'Core').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Core Tech</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.type === 'Core' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.type === 'Core' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.type === 'Core' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.type === 'Scenario').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Scenario / Cases</div>
                                                    <div className="text-[9px] text-slate-500 font-semibold mt-1">
                                                        E: {questionsList.filter(q => q.type === 'Scenario' && q.difficulty === 'easy').length} | 
                                                        M: {questionsList.filter(q => q.type === 'Scenario' && q.difficulty === 'medium').length} | 
                                                        H: {questionsList.filter(q => q.type === 'Scenario' && q.difficulty === 'hard').length}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.type === 'Behavioral Experience').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Behavioral Exp</div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div className="text-2xl font-black text-slate-800">{questionsList.filter(q => q.type === 'Behavioral Situation').length}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Behavioral Sit</div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedRole === 'APTITUDE' ? (
                                            <>
                                                {/* Auto balance trigger alerts for all Aptitude sections */}
                                                {['Quantitative', 'Logical', 'Analytical', 'Verbal'].map(sec => {
                                                    const easy = questionsList.filter(q => q.category === sec && q.difficulty === 'easy').length;
                                                    const medium = questionsList.filter(q => q.category === sec && q.difficulty === 'medium').length;
                                                    const hard = questionsList.filter(q => q.category === sec && q.difficulty === 'hard').length;
                                                    
                                                    const min = Math.min(easy, medium, hard);
                                                    const max = Math.max(easy, medium, hard);
                                                    const isImbalanced = min < 3 || (max - min) > 4;

                                                    return (
                                                        <div key={sec} className={`p-5 rounded-2xl border ${isImbalanced ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50 border-slate-200/60'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-bold text-slate-800">{sec} Section Distribution</h4>
                                                                <p className="text-xs text-slate-500">Current: Easy: <span className="font-semibold text-slate-700">{easy}</span> | Medium: <span className="font-semibold text-slate-700">{medium}</span> | Hard: <span className="font-semibold text-slate-700">{hard}</span></p>
                                                                {isImbalanced ? (
                                                                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1"><AlertTriangle size={13} /> Imbalanced (recommended at least 3-5 questions per difficulty).</p>
                                                                ) : (
                                                                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Well balanced difficulty distribution.</p>
                                                                )}
                                                            </div>
                                                            {isImbalanced && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const secQs = questionsList.filter(q => q.category === sec);
                                                                        const target = Math.round(secQs.length / 3);
                                                                        const counts = {
                                                                            easy: { count: easy, list: secQs.filter(q => q.difficulty === 'easy') },
                                                                            medium: { count: medium, list: secQs.filter(q => q.difficulty === 'medium') },
                                                                            hard: { count: hard, list: secQs.filter(q => q.difficulty === 'hard') }
                                                                        };
                                                                        
                                                                        const targetDiffs = { easy: target, medium: target, hard: target };
                                                                        const diffSum = target * 3;
                                                                        if (diffSum < secQs.length) {
                                                                            targetDiffs.medium += (secQs.length - diffSum);
                                                                        } else if (diffSum > secQs.length) {
                                                                            targetDiffs.easy -= (diffSum - secQs.length);
                                                                        }

                                                                        const keys = ['easy', 'medium', 'hard'] as const;
                                                                        const suggestionsList: typeof balanceSuggestions = [];
                                                                        
                                                                        let iters = 0;
                                                                        while (iters < 50) {
                                                                            const underKey = keys.find(k => counts[k].count < targetDiffs[k]);
                                                                            const overKey = keys.find(k => counts[k].count > targetDiffs[k]);
                                                                            if (!underKey || !overKey) break;

                                                                            const qToShift = counts[overKey].list.pop();
                                                                            if (qToShift) {
                                                                                suggestionsList.push({
                                                                                    id: qToShift.id,
                                                                                    text: qToShift.question,
                                                                                    current: overKey,
                                                                                    suggested: underKey
                                                                                });
                                                                                counts[overKey].count--;
                                                                                counts[underKey].count++;
                                                                            }
                                                                            iters++;
                                                                        }

                                                                        if (suggestionsList.length > 0) {
                                                                            setBalanceSuggestions(suggestionsList);
                                                                            setQuestionsFilter(sec); // Set filter to match suggestion category context
                                                                            setBalanceModalOpen(true);
                                                                        } else {
                                                                            alert("Could not generate balancing suggestions automatically. Please edit difficulties manually.");
                                                                        }
                                                                    }}
                                                                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-sm shrink-0 active:scale-[0.98]"
                                                                >
                                                                    Suggest Auto-Balance
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <>
                                                {/* Auto balance trigger alerts for both Core and Scenario stage difficulty metrics */}
                                                {['Core', 'Scenario'].map(stage => {
                                                    const easy = questionsList.filter(q => q.type === stage && q.difficulty === 'easy').length;
                                                    const medium = questionsList.filter(q => q.type === stage && q.difficulty === 'medium').length;
                                                    const hard = questionsList.filter(q => q.type === stage && q.difficulty === 'hard').length;
                                                    
                                                    const min = Math.min(easy, medium, hard);
                                                    const max = Math.max(easy, medium, hard);
                                                    const isImbalanced = min < 5 || (max - min) > 3;

                                                    return (
                                                        <div key={stage} className={`p-5 rounded-2xl border ${isImbalanced ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50/50 border-slate-200/60'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                                                            <div className="space-y-1">
                                                                <h4 className="text-sm font-bold text-slate-800">{stage} Stage Distribution</h4>
                                                                <p className="text-xs text-slate-500">Current: Easy: <span className="font-semibold text-slate-700">{easy}</span> | Medium: <span className="font-semibold text-slate-700">{medium}</span> | Hard: <span className="font-semibold text-slate-700">{hard}</span></p>
                                                                {isImbalanced ? (
                                                                    <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1"><AlertTriangle size={13} /> Imbalanced (recommended 10/10/10 split for robust adaptive testing).</p>
                                                                ) : (
                                                                    <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 size={13} /> Well balanced difficulty distribution.</p>
                                                                )}
                                                            </div>
                                                            {isImbalanced && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const stageQs = questionsList.filter(q => q.type === stage);
                                                                        const target = Math.round(stageQs.length / 3);
                                                                        const counts = {
                                                                            easy: { count: easy, list: stageQs.filter(q => q.difficulty === 'easy') },
                                                                            medium: { count: medium, list: stageQs.filter(q => q.difficulty === 'medium') },
                                                                            hard: { count: hard, list: stageQs.filter(q => q.difficulty === 'hard') }
                                                                        };
                                                                        
                                                                        const targetDiffs = { easy: target, medium: target, hard: target };
                                                                        const diffSum = target * 3;
                                                                        if (diffSum < stageQs.length) {
                                                                            targetDiffs.medium += (stageQs.length - diffSum);
                                                                        } else if (diffSum > stageQs.length) {
                                                                            targetDiffs.easy -= (diffSum - stageQs.length);
                                                                        }

                                                                        const keys = ['easy', 'medium', 'hard'] as const;
                                                                        const suggestionsList: typeof balanceSuggestions = [];
                                                                        
                                                                        let iters = 0;
                                                                        while (iters < 50) {
                                                                            const underKey = keys.find(k => counts[k].count < targetDiffs[k]);
                                                                            const overKey = keys.find(k => counts[k].count > targetDiffs[k]);
                                                                            if (!underKey || !overKey) break;

                                                                            const qToShift = counts[overKey].list.pop();
                                                                            if (qToShift) {
                                                                                suggestionsList.push({
                                                                                    id: qToShift.id,
                                                                                    text: qToShift.question,
                                                                                    current: overKey,
                                                                                    suggested: underKey
                                                                                });
                                                                                counts[overKey].count--;
                                                                                counts[underKey].count++;
                                                                            }
                                                                            iters++;
                                                                        }

                                                                        if (suggestionsList.length > 0) {
                                                                            setBalanceSuggestions(suggestionsList);
                                                                            setQuestionsFilter(stage); // Set filter to match suggestion stage context
                                                                            setBalanceModalOpen(true);
                                                                        } else {
                                                                            alert("Could not generate balancing suggestions automatically. Please edit difficulties manually.");
                                                                        }
                                                                    }}
                                                                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-sm shrink-0 active:scale-[0.98]"
                                                                >
                                                                    Suggest Auto-Balance
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* AUTO-BALANCE SUGGESTIONS MODAL */}
                            {balanceModalOpen && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                    <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col p-6 space-y-6">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                                <Sliders size={20} className="text-indigo-600" /> Auto-Balance Suggestions
                                            </h3>
                                            <button onClick={() => setBalanceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                <X size={20} />
                                            </button>
                                        </div>
                                        
                                        <p className="text-xs text-slate-500">
                                             The following shifts are suggested to reach target balance of approximately equal distribution in {selectedRole === 'APTITUDE' ? `Section ${questionsFilter}` : `Stage ${questionsFilter}`} (Recommended: equal split of Easy, Medium, Hard). Select the ones you approve.
                                         </p>

                                        <div className="space-y-3 flex-1 overflow-y-auto max-h-[40vh] pr-2">
                                            {balanceSuggestions.map(sugg => (
                                                <label key={sugg.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100/85 border border-slate-200/40 cursor-pointer transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        defaultChecked 
                                                        id={`sugg-${sugg.id}`}
                                                        className="mt-1 accent-indigo-600 rounded border-slate-300 w-4 h-4 shrink-0" 
                                                    />
                                                    <div>
                                                        <p className="text-xs text-slate-700 font-medium line-clamp-2">"{sugg.text}"</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded capitalize">{sugg.current}</span>
                                                            <span className="text-[10px] text-slate-400">➔</span>
                                                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded capitalize">{sugg.suggested}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                            <button 
                                                onClick={() => setBalanceModalOpen(false)} 
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const approvedIds = balanceSuggestions.filter(s => {
                                                        const el = document.getElementById(`sugg-${s.id}`) as HTMLInputElement | null;
                                                        return el ? el.checked : true;
                                                    }).map(s => s.id);
                                                    
                                                    const updated = questionsList.map(q => {
                                                        const sugg = balanceSuggestions.find(s => s.id === q.id);
                                                        if (sugg && approvedIds.includes(q.id)) {
                                                            return { 
                                                                ...q, 
                                                                difficulty: sugg.suggested as any,
                                                                version: (q.version || 1) + 1,
                                                                updatedAt: new Date().toISOString()
                                                            };
                                                        }
                                                        return q;
                                                    });
                                                    setQuestionsList(updated);
                                                    setBalanceModalOpen(false);
                                                    setBalanceSuggestions([]);
                                                    setSuccessMessage(`Applied Auto-Balance shifts to ${approvedIds.length} questions! Click 'Save Changes' to apply to database.`);
                                                    setTimeout(() => setSuccessMessage(null), 5000);
                                                }}
                                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98]"
                                            >
                                                Apply Selected Shifts
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* IMPORT CSV/JSON WIZARD DIALOG MODAL */}
                            {importModalOpen && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col p-6 space-y-6">
                                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                                                <Upload size={20} className="text-indigo-600" /> Import Questions Wizard
                                            </h3>
                                            <button onClick={() => { setImportModalOpen(false); setImportPreviewData(null); }} className="text-slate-400 hover:text-slate-600">
                                                <X size={20} />
                                            </button>
                                        </div>

                                        {!importPreviewData ? (
                                            /* UPLOAD STATE */
                                            <div className="space-y-4">
                                                <p className="text-xs text-slate-500">
                                                    Upload a JSON or CSV file containing question bank data. CSV header keys should include: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">question</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">difficulty</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">type</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">category</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px]">evaluationGuide</code> (semicolon separated).
                                                </p>
                                                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-10 text-center transition-colors relative cursor-pointer">
                                                    <input 
                                                        type="file" 
                                                        accept=".csv,.json"
                                                        onChange={handleFileUpload}
                                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                    />
                                                    <Upload size={32} className="text-slate-400 mx-auto mb-3" />
                                                    <p className="text-xs font-bold text-slate-700">Click to upload or drag-and-drop</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Supports CSV or JSON (max 5MB)</p>
                                                </div>
                                            </div>
                                        ) : (
                                            /* PREVIEW & VALIDATION REPORT STATE */
                                            <div className="space-y-5 flex-1 overflow-y-auto max-h-[50vh] pr-2">
                                                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Validation Report</p>
                                                        <h4 className="text-sm font-black text-slate-800 mt-0.5">{importFileName}</h4>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <div className="text-center">
                                                            <span className="text-xs font-black text-emerald-600 block">{importPreviewData.validCount}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase">Valid</span>
                                                        </div>
                                                        {importPreviewData.warningsCount > 0 && (
                                                            <div className="text-center">
                                                                <span className="text-xs font-black text-amber-600 block">{importPreviewData.warningsCount}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Warnings</span>
                                                            </div>
                                                        )}
                                                        {importPreviewData.errorsCount > 0 && (
                                                            <div className="text-center">
                                                                <span className="text-xs font-black text-rose-600 block">{importPreviewData.errorsCount}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Errors</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Error Logs */}
                                                {importPreviewData.errors.length > 0 && (
                                                    <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-2xl space-y-2">
                                                        <p className="text-[10px] font-black text-rose-800 uppercase tracking-wider">Validation Errors & Warnings Log</p>
                                                        <div className="text-[11px] font-medium space-y-1.5 max-h-[15vh] overflow-y-auto">
                                                            {importPreviewData.errors.map((err, i) => (
                                                                <div key={i} className="flex gap-2">
                                                                    <span className="font-mono text-slate-400">Row {err.row}:</span>
                                                                    <span className={err.severity === 'error' ? 'text-rose-600 font-bold' : 'text-amber-600'}>
                                                                        [{err.severity.toUpperCase()}] {err.msg}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Merge Strategy Option */}
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-700">Merge Strategy</h4>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">Define how questions are loaded into the database bank.</p>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-2">
                                                        <button 
                                                            onClick={() => setImportMergeStrategy('append')}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                                                importMergeStrategy === 'append' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500'
                                                            }`}
                                                        >
                                                            Append New
                                                        </button>
                                                        <button 
                                                            onClick={() => setImportMergeStrategy('replace')}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all ${
                                                                importMergeStrategy === 'replace' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500'
                                                            }`}
                                                        >
                                                            Replace All
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Preview Table */}
                                                <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                                                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                                                        <thead className="bg-slate-50 text-slate-500 font-bold">
                                                            <tr>
                                                                <th className="px-4 py-2">Status</th>
                                                                <th className="px-4 py-2">Question Text</th>
                                                                <th className="px-4 py-2">Difficulty</th>
                                                                <th className="px-4 py-2">Stage</th>
                                                                <th className="px-4 py-2">Category</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {importPreviewData.questions.slice(0, 5).map((q, idx) => (
                                                                <tr key={idx}>
                                                                    <td className="px-4 py-2">
                                                                        {q.isValid ? (
                                                                            <span className="text-emerald-600 font-bold">✓ Valid</span>
                                                                        ) : (
                                                                            <span className="text-rose-600 font-bold">✕ Error</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 max-w-50 truncate" title={q.question}>{q.question}</td>
                                                                    <td className="px-4 py-2 capitalize">{q.difficulty}</td>
                                                                    <td className="px-4 py-2">{q.type}</td>
                                                                    <td className="px-4 py-2">{q.category}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {importPreviewData.questions.length > 5 && (
                                                        <div className="p-2 bg-slate-50 text-center text-[10px] text-slate-400 font-semibold border-t border-slate-100">
                                                            + {importPreviewData.questions.length - 5} more questions in file...
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
                                            <button 
                                                onClick={() => { setImportModalOpen(false); setImportPreviewData(null); }} 
                                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                            >
                                                Cancel
                                            </button>
                                            {importPreviewData && (
                                                <button 
                                                    onClick={handleCompleteImport}
                                                    disabled={importPreviewData.validCount === 0}
                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98]"
                                                >
                                                    Complete Import ({importPreviewData.validCount} Valid Rows)
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* EDIT / ADD QUESTION MODAL */}
                            {editingQuestion && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                                    <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
                                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                            <h3 className="font-extrabold text-slate-800 text-lg">
                                                {isAddModalOpen ? 'Add New Question' : `Edit Question (v${editingQuestion.version || 1})`}
                                            </h3>
                                            <button 
                                                onClick={() => { setEditingQuestion(null); setIsAddModalOpen(false); }} 
                                                className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>

                                        <div className="p-6 space-y-5 overflow-y-auto flex-1 max-h-[65vh]">
                                            {/* Question Input */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Question Text</label>
                                                <textarea 
                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-sm outline-none transition-all resize-y h-24 text-slate-800 font-medium" 
                                                    value={editingQuestion.question} 
                                                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })} 
                                                />
                                                                            {selectedRole === 'APTITUDE' ? (
                                                <>
                                                    {/* Category & Difficulty */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                                                            <select
                                                                value={editingQuestion.category || 'Quantitative'}
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })}
                                                                className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all bg-white text-slate-800 font-semibold"
                                                            >
                                                                <option value="Quantitative">Quantitative Aptitude</option>
                                                                <option value="Logical">Logical Reasoning</option>
                                                                <option value="Analytical">Analytical Reasoning</option>
                                                                <option value="Verbal">Verbal Aptitude</option>
                                                            </select>
                                                        </div>

                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Difficulty Level</label>
                                                            <select 
                                                                value={editingQuestion.difficulty || 'medium'}
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                                                                className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all bg-white text-slate-800 font-semibold"
                                                            >
                                                                <option value="easy">Easy</option>
                                                                <option value="medium">Medium</option>
                                                                <option value="hard">Hard</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Options A, B, C, D */}
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">MCQ Options</label>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                            {['A', 'B', 'C', 'D'].map((lbl, idx) => {
                                                                const opts = editingQuestion.options || ["", "", "", ""];
                                                                return (
                                                                    <div key={lbl} className="flex gap-2 items-center">
                                                                        <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 shrink-0">
                                                                            {lbl}
                                                                        </span>
                                                                        <input
                                                                            type="text"
                                                                            value={opts[idx] || ""}
                                                                            onChange={(e) => {
                                                                                const nextOpts = [...opts];
                                                                                nextOpts[idx] = e.target.value;
                                                                                setEditingQuestion({
                                                                                    ...editingQuestion,
                                                                                    options: nextOpts
                                                                                });
                                                                            }}
                                                                            placeholder={`Option ${lbl} text`}
                                                                            className="flex-1 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2 text-xs outline-none transition-all text-slate-800 font-medium"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Correct Answer Selector */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Correct Answer Option</label>
                                                        <select
                                                            value={editingQuestion.answer || 'A'}
                                                            onChange={(e) => setEditingQuestion({ ...editingQuestion, answer: e.target.value })}
                                                            className="w-40 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all bg-white text-slate-800 font-semibold"
                                                        >
                                                            <option value="A">Option A</option>
                                                            <option value="B">Option B</option>
                                                            <option value="C">Option C</option>
                                                            <option value="D">Option D</option>
                                                        </select>
                                                    </div>

                                                    {/* Solution Explanation */}
                                                    <div>
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Solution Explanation</label>
                                                        <textarea
                                                            value={editingQuestion.explanation || ''}
                                                            onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                                                            placeholder="Detail the step-by-step mathematical or logical solution explanation..."
                                                            className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-3 text-xs outline-none transition-all resize-y h-20 text-slate-800 font-medium"
                                                        />
                                                    </div>

                                                    {/* Image Attachment & Upload */}
                                                    <div className="space-y-2 border-t border-slate-100 pt-4">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Optional Image Attachment</label>
                                                        <div className="flex flex-col md:flex-row gap-3 items-stretch">
                                                            <input
                                                                type="text"
                                                                value={editingQuestion.imageUrl || ''}
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, imageUrl: e.target.value })}
                                                                placeholder="Paste direct Image URL or upload a file..."
                                                                className="flex-1 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all text-slate-800 font-medium"
                                                            />
                                                            <div className="relative">
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    onChange={handleImageUpload}
                                                                    id="mcq-img-upload"
                                                                    className="hidden"
                                                                />
                                                                <label
                                                                    htmlFor="mcq-img-upload"
                                                                    className={`px-4 py-2.5 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer h-full ${
                                                                        isUploading ? 'opacity-50 pointer-events-none' : ''
                                                                    }`}
                                                                >
                                                                    {isUploading ? 'Uploading...' : 'Upload File'}
                                                                </label>
                                                            </div>
                                                        </div>
                                                        {editingQuestion.imageUrl && (
                                                            <div className="relative border border-slate-200 rounded-2xl overflow-hidden max-h-40 bg-slate-50 p-2 flex justify-center items-center group max-w-sm mt-2">
                                                                <img src={editingQuestion.imageUrl} alt="Attached Preview" className="object-contain max-h-36" />
                                                                <button
                                                                    onClick={() => setEditingQuestion({ ...editingQuestion, imageUrl: undefined })}
                                                                    className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-lg p-1.5 hover:bg-red-600 transition-colors text-xs font-bold"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Difficulty */}
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Difficulty Level</label>
                                                            <select 
                                                                value={editingQuestion.difficulty || 'medium'}
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value as any })}
                                                                className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all bg-white text-slate-800 font-semibold"
                                                            >
                                                                <option value="easy">Easy</option>
                                                                <option value="medium">Medium</option>
                                                                <option value="hard">Hard (High Level)</option>
                                                            </select>
                                                        </div>

                                                        {/* Stage / Type */}
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Flow Stage (Type)</label>
                                                            <select 
                                                                value={editingQuestion.type || 'Core'}
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, type: e.target.value as any })}
                                                                className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all bg-white text-slate-800 font-semibold"
                                                            >
                                                                <option value="Fundamentals">Stage 1: Fundamentals</option>
                                                                <option value="Core">Stage 2: Core Technical</option>
                                                                <option value="Scenario">Stage 3: Scenario Case Study</option>
                                                                <option value="Behavioral Experience">Stage 4: Behavioral Experience</option>
                                                                <option value="Behavioral Situation">Stage 5: Behavioral Situation</option>
                                                            </select>
                                                        </div>

                                                        {/* Category */}
                                                        <div className="md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                                                            <input 
                                                                className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all text-slate-800 font-semibold" 
                                                                value={editingQuestion.category || ''} 
                                                                onChange={(e) => setEditingQuestion({ ...editingQuestion, category: e.target.value })} 
                                                                placeholder="e.g. Technical"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Evaluation Areas Checklist Manager */}
                                                    <div className="space-y-3 pt-2">
                                                        <div className="flex justify-between items-center">
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation Checklist Areas (AI Grading Standard)</label>
                                                            <button 
                                                                onClick={() => {
                                                                    const currentGuide = editingQuestion.evaluationGuide || [];
                                                                    setEditingQuestion({
                                                                        ...editingQuestion,
                                                                        evaluationGuide: [...currentGuide, ""]
                                                                    });
                                                                }}
                                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                                                            >
                                                                + Add Area
                                                            </button>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            {(editingQuestion.evaluationGuide || []).length === 0 ? (
                                                                <p className="text-xs text-rose-500 font-semibold italic">No evaluation areas added. At least one area is required.</p>
                                                            ) : (
                                                                (editingQuestion.evaluationGuide || []).map((area, idx) => (
                                                                    <div key={idx} className="flex gap-3 items-center">
                                                                        <input 
                                                                            className="flex-1 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all text-slate-800 font-medium"
                                                                            value={area}
                                                                            onChange={(e) => {
                                                                                const updated = [...(editingQuestion.evaluationGuide || [])];
                                                                                updated[idx] = e.target.value;
                                                                                setEditingQuestion({
                                                                                    ...editingQuestion,
                                                                                    evaluationGuide: updated
                                                                                });
                                                                            }}
                                                                            placeholder="Describe the expected candidate answer point or checklist item..."
                                                                        />
                                                                        <button 
                                                                            onClick={() => {
                                                                                const updated = (editingQuestion.evaluationGuide || []).filter((_, i) => i !== idx);
                                                                                setEditingQuestion({
                                                                                    ...editingQuestion,
                                                                                    evaluationGuide: updated
                                                                                });
                                                                            }}
                                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-colors"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Preview & Test Evaluation Simulator */}
                                                    <div className="border-t border-slate-100 pt-4 space-y-3">
                                                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                                            <Terminal size={14} className="text-indigo-500" /> Preview/Test AI Grading
                                                        </h4>
                                                        <p className="text-[10px] text-slate-400 leading-normal">
                                                            Verify your evaluation guide by grading a mock candidate response before saving.
                                                        </p>
                                                        
                                                        <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                            <div>
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Sample Answer</label>
                                                                <textarea 
                                                                    className="w-full border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl p-2.5 text-xs outline-none transition-all resize-y h-16 text-slate-800 bg-white" 
                                                                    placeholder="Type a sample answer to test..." 
                                                                    value={testAnswer}
                                                                    onChange={(e) => setTestAnswer(e.target.value)}
                                                                />
                                                            </div>
                                                            
                                                            <div className="flex justify-between items-center">
                                                                <button 
                                                                    onClick={handleTestGrading}
                                                                    disabled={isTesting || !testAnswer.trim()}
                                                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 text-indigo-600 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                                                                >
                                                                    {isTesting ? (
                                                                        <>
                                                                            <RefreshCw size={12} className="animate-spin" /> Testing...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Play size={12} /> Run Test Grading
                                                                        </>
                                                                    )}
                                                                </button>
                                                                
                                                                {testResult && !testResult.error && (
                                                                    <div className="text-[10px] font-bold text-slate-600 flex items-center gap-2">
                                                                        Expected Score: 
                                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                                                            testResult.contentScore >= 8 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                            testResult.contentScore >= 6 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                                                            testResult.contentScore >= 4 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                                            'bg-rose-50 text-rose-700 border border-rose-100'
                                                                        }`}>
                                                                            {testResult.contentScore}/10 ({testResult.verdict})
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {testResult && (
                                                                <div className="border-t border-slate-200/60 pt-3 space-y-2 mt-2">
                                                                    {testResult.error ? (
                                                                        <p className="text-xs text-rose-500 font-medium">{testResult.error}</p>
                                                                    ) : (
                                                                        <div className="text-[11px] space-y-2.5">
                                                                            <div>
                                                                                <span className="font-bold text-slate-650 block mb-0.5">AI Feedback:</span>
                                                                                <p className="text-slate-500 italic bg-white p-2.5 rounded-xl border border-slate-100 leading-relaxed font-sans">{formatFeedbackToString(testResult.feedback)}</p>
                                                                            </div>
                                                                            <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100/85">
                                                                                <div>
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Honesty Score</span>
                                                                                    <span className="font-bold text-slate-700">{testResult.honestyScore !== undefined ? `${testResult.honestyScore}/10` : 'N/A'}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Knowledge Admission</span>
                                                                                    <span className="font-bold text-slate-700">{testResult.knowledgeAdmissionScore !== undefined ? `${testResult.knowledgeAdmissionScore}/10` : 'N/A'}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bluff Risk</span>
                                                                                    <span className={`font-black uppercase text-[10px] ${
                                                                                        testResult.bluffRisk === 'HIGH' ? 'text-rose-600' :
                                                                                        testResult.bluffRisk === 'MEDIUM' ? 'text-amber-600' :
                                                                                        'text-emerald-600'
                                                                                    }`}>{testResult.bluffRisk || 'LOW'}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Misconception Risk</span>
                                                                                    <span className={`font-black uppercase text-[10px] ${
                                                                                        testResult.misconceptionRisk === 'HIGH' ? 'text-rose-600' :
                                                                                        testResult.misconceptionRisk === 'MEDIUM' ? 'text-amber-600' :
                                                                                        'text-emerald-605'
                                                                                    }`}>{testResult.misconceptionRisk || 'LOW'}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Calibration</span>
                                                                                    <span className={`font-black uppercase text-[9px] ${
                                                                                        testResult.confidenceCalibration === 'OVERCONFIDENT' ? 'text-rose-600' :
                                                                                        testResult.confidenceCalibration === 'UNDERCONFIDENT' ? 'text-amber-600' :
                                                                                        'text-emerald-605'
                                                                                    }`}>{testResult.confidenceCalibration || 'CALIBRATED'}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <div>
                                                                                    <span className="font-bold text-emerald-700 block mb-1">✓ Concepts Explained:</span>
                                                                                    {(testResult.explainedConcepts?.length > 0 || testResult.matchedKeyPoints?.length > 0) ? (
                                                                                        <ul className="list-disc list-inside text-emerald-600 space-y-0.5 pl-1">
                                                                                            {(testResult.explainedConcepts || testResult.matchedKeyPoints).map((p: string, i: number) => <li key={i}>{p}</li>)}
                                                                                        </ul>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 italic text-[10px]">None</span>
                                                                                    )}
                                                                                </div>
                                                                                <div>
                                                                                    <span className="font-bold text-rose-700 block mb-1">✕ Areas Missed:</span>
                                                                                    {testResult.missingKeyPoints?.length > 0 ? (
                                                                                        <ul className="list-disc list-inside text-rose-600 space-y-0.5 pl-1">
                                                                                            {testResult.missingKeyPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                                                                        </ul>
                                                                                    ) : (
                                                                                        <span className="text-slate-400 italic text-[10px]">None</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}                  </div>
                                        </div>

                                        <div className="p-6 border-t border-slate-100 flex justify-between gap-3 shrink-0">
                                            {!isAddModalOpen ? (
                                                <button
                                                    onClick={() => handleDeleteQuestion(editingQuestion.id)}
                                                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl transition-all active:scale-[0.98]"
                                                >
                                                    Delete Question
                                                </button>
                                            ) : (
                                                <div></div>
                                            )}
                                            <div className="flex gap-3">
                                                <button 
                                                    onClick={() => { setEditingQuestion(null); setIsAddModalOpen(false); }} 
                                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={handleSaveModal}
                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98]"
                                                >
                                                    {isAddModalOpen ? 'Add Question' : 'Save Changes'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: PROCTORING SETTINGS */}
                    {activeTab === 'proctoring' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                        <ShieldAlert className="text-indigo-500" size={22} /> Proctoring Settings & Violations Thresholds
                                    </h3>
                                    <p className="text-xs text-slate-400">Configure real-time warning and automatic termination rules for candidates.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Reset proctoring thresholds to standard defaults?")) {
                                                setProctorSettings(DEFAULT_PROCTORING_SETTINGS);
                                            }
                                        }}
                                        className="px-4 py-2 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        Reset to Defaults
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsSavingProctor(true);
                                            setProctorSuccessMsg(null);
                                            const ok = await SupabaseService.saveSystemSettings('proctoring_settings', proctorSettings, 'Super Admin');
                                            if (ok) {
                                                setProctorSuccessMsg("Proctoring configuration updated successfully!");
                                                const proMeta = await SupabaseService.getSystemSettingsMetadata('proctoring_settings');
                                                if (proMeta) setProctorMetadata(proMeta);
                                                setTimeout(() => setProctorSuccessMsg(null), 4000);
                                            } else {
                                                alert("Failed to save settings. Please verify database connection.");
                                            }
                                            setIsSavingProctor(false);
                                        }}
                                        disabled={isSavingProctor}
                                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black transition-all shadow-md active:scale-[0.98]"
                                    >
                                        {isSavingProctor ? "Saving..." : "Save Configuration"}
                                    </button>
                                </div>
                            </div>

                            {proctorSuccessMsg && (
                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-5 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-250">
                                    ✓ {proctorSuccessMsg}
                                </div>
                            )}

                            {/* Badge/Metadata Card */}
                            <div className="bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-indigo-900/40 shadow-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/35">
                                        <CheckCircle2 size={20} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300">Current Active Configuration</h4>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Enforced globally across all active candidate interviews</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 md:gap-8 text-xs font-medium">
                                    <div>
                                        <span className="text-slate-400 block text-[9px] uppercase tracking-widest font-bold">Last Updated</span>
                                        <span className="text-slate-200 font-mono mt-0.5 block">
                                            {proctorMetadata ? (() => {
                                                const date = new Date(proctorMetadata.updated_at);
                                                const day = date.getDate();
                                                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                                const month = monthNames[date.getMonth()];
                                                const year = date.getFullYear();
                                                let hours = date.getHours();
                                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                                hours = hours % 12;
                                                hours = hours ? hours : 12;
                                                return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
                                            })() : '25 June 2026 12:45 PM'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[9px] uppercase tracking-widest font-bold">Admin</span>
                                        <span className="text-slate-200 mt-0.5 block">{proctorMetadata?.updated_by || 'Super Admin'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Face Missing Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Face Detection
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.faceMissingWarningSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="3" max="30" step="1"
                                                value={proctorSettings.faceMissingWarningSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, faceMissingWarningSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.faceMissingTerminateSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="10" max="120" step="5"
                                                value={proctorSettings.faceMissingTerminateSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, faceMissingTerminateSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Tab Switches Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Tab Switches
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.tabSwitchWarningCount} switches</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="5" step="1"
                                                value={proctorSettings.tabSwitchWarningCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, tabSwitchWarningCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.tabSwitchTerminateCount} switches</span>
                                            </div>
                                            <input 
                                                type="range" min="2" max="10" step="1"
                                                value={proctorSettings.tabSwitchTerminateCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, tabSwitchTerminateCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fullscreen Exit Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Fullscreen Exit (Aptitude Assessment)
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.fullscreenExitWarningCount} exits</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="3" step="1"
                                                value={proctorSettings.fullscreenExitWarningCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, fullscreenExitWarningCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.fullscreenExitTerminateCount} exits</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="5" step="1"
                                                value={proctorSettings.fullscreenExitTerminateCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, fullscreenExitTerminateCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Multiple Faces Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Multiple Faces Detection
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.multipleFacesWarningCount} detections</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="5" step="1"
                                                value={proctorSettings.multipleFacesWarningCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, multipleFacesWarningCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Count Limit</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.multipleFacesTerminateCount} detections</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="10" step="1"
                                                value={proctorSettings.multipleFacesTerminateCount}
                                                onChange={e => setProctorSettings({ ...proctorSettings, multipleFacesTerminateCount: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Camera Off Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Camera Disconnection
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.cameraOffWarningSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="3" max="30" step="1"
                                                value={proctorSettings.cameraOffWarningSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, cameraOffWarningSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.cameraOffTerminateSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="10" max="120" step="5"
                                                value={proctorSettings.cameraOffTerminateSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, cameraOffTerminateSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Mic Off Rules */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" /> Microphone Disconnection
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Warning Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.micOffWarningSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="3" max="30" step="1"
                                                value={proctorSettings.micOffWarningSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, micOffWarningSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-semibold text-slate-650">Termination Duration Threshold</span>
                                                <span className="font-bold text-indigo-600">{proctorSettings.micOffTerminateSec} seconds</span>
                                            </div>
                                            <input 
                                                type="range" min="10" max="120" step="5"
                                                value={proctorSettings.micOffTerminateSec}
                                                onChange={e => setProctorSettings({ ...proctorSettings, micOffTerminateSec: parseInt(e.target.value) })}
                                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: SYSTEM HEALTH */}
                    {activeTab === 'system' && (
                        <div data-tour="admin-system-panel" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
                            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-slate-800 text-lg">System Verification Panel</h3>
                                    <p className="text-xs text-slate-400">Live operational status of API tokens and database services.</p>
                                </div>
                                {health && (
                                    <div className="text-xs text-slate-500 flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
                                        <Activity size={14} className="text-indigo-500" /> Last Checked: {new Date(health.lastChecked).toLocaleTimeString()}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Core Services check */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <Server className="text-indigo-500 shrink-0" size={18} /> Infrastructure Connectivity
                                    </h3>
                                    
                                    <div className="space-y-3.5">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <div className="flex items-center gap-3">
                                                <Database size={18} className="text-slate-400 shrink-0" />
                                                <span className="font-semibold text-xs text-slate-700">Supabase SQL Database</span>
                                            </div>
                                            {health?.database ? (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">ONLINE</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">OFFLINE</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <div className="flex items-center gap-3">
                                                <Server size={18} className="text-slate-400 shrink-0" />
                                                <span className="font-semibold text-xs text-slate-700">Storage Buckets (Media)</span>
                                            </div>
                                            {health?.storage ? (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">CONNECTED</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">MISSING</span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <div className="flex items-center gap-3">
                                                <Lock size={18} className="text-slate-400 shrink-0" />
                                                <span className="font-semibold text-xs text-slate-700">Authentication Service</span>
                                            </div>
                                            {health?.auth ? (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">OPERATIONAL</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">OFFLINE</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Environment Data Count */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <Database className="text-indigo-500 shrink-0" size={18} /> Database Records Count
                                    </h3>
                                    
                                    <div className="space-y-3.5">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="font-semibold text-xs text-slate-700">Active Technical Question Banks</span>
                                            <span className="text-slate-800 font-bold text-sm">2 Roles (CSE & ECE)</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="font-semibold text-xs text-slate-700">Interview Session Records</span>
                                            <span className="text-slate-800 font-bold text-sm">{sessions.length} sessions</span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="font-semibold text-xs text-slate-700">Unique Evaluated Candidates</span>
                                            <span className="text-slate-800 font-bold text-sm">
                                                {new Set(sessions.map(s => s.candidate.email)).size} candidates
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* OpenRouter Token Tracker */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <Terminal className="text-indigo-500 shrink-0" size={18} /> OpenRouter Token Tracker
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="text-[10px] font-bold text-slate-400 block">Total Tokens Consumed</span>
                                            <span className="text-slate-800 font-black text-lg font-mono block mt-1">{(tokenStats.total_tokens || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="text-[10px] font-bold text-slate-400 block">Total LLM Calls</span>
                                            <span className="text-slate-800 font-black text-lg font-mono block mt-1">{tokenStats.total_calls || 0} calls</span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="text-[10px] font-bold text-slate-400 block">Prompt / Completion Ratio</span>
                                            <span className="text-slate-850 font-bold text-xs mt-1 block">
                                                P: {(tokenStats.prompt_tokens || 0).toLocaleString()} <br/>
                                                C: {(tokenStats.completion_tokens || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <span className="text-[10px] font-bold text-slate-400 block">Average Tokens / Session</span>
                                            <span className="text-slate-800 font-black text-lg font-mono block mt-1">
                                                {sessions.filter(s => !s.isDeleted && s.status === 'COMPLETED').length > 0 
                                                    ? Math.round((tokenStats.total_tokens || 0) / sessions.filter(s => !s.isDeleted && s.status === 'COMPLETED').length).toLocaleString()
                                                    : (tokenStats.total_tokens || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Speech STT Capability Check */}
                                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <Activity className="text-indigo-500 shrink-0" size={18} /> Browser Speech STT Capability
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/40">
                                            <div className="flex items-center gap-3">
                                                <Activity size={18} className="text-slate-400 shrink-0" />
                                                <span className="font-semibold text-xs text-slate-700">Web Speech API Support</span>
                                            </div>
                                            {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) ? (
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">COMPATIBLE</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">UNSUPPORTED</span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-normal pl-1">
                                            The platform utilizes the native browser Web Speech API for high-speed, zero-latency speech-to-text transcriptions during voice-interviews. Ensure Google Chrome, Microsoft Edge or Safari is used.
                                        </p>
                                    </div>
                                </div>
                                </div>
                                </div>
                    )}

                    {/* TAB 4: SYSTEM ERROR LOGS */}
                    {activeTab === 'errors' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex flex-col gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-slate-800 text-lg">System Errors Monitor</h3>
                                    <p className="text-xs text-slate-400">View real-time and historical runtime exceptions during interviews and evaluation.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    <select
                                        value={errorsFilter}
                                        onChange={(e) => setErrorsFilter(e.target.value)}
                                        className="flex-1 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 rounded-xl px-4 py-2.5 text-xs outline-none bg-white text-slate-700 font-bold shadow-sm"
                                    >
                                        <option value="all">All Error Categories</option>
                                        <option value="database">Database Errors</option>
                                        <option value="api">API / LLM Errors</option>
                                        <option value="proctoring">Proctoring Errors</option>
                                        <option value="interview">Interview Flow Errors</option>
                                        <option value="evaluation">Grading Errors</option>
                                        <option value="system">Core System Errors</option>
                                    </select>
                                    <button
                                        onClick={handleClearErrorLogs}
                                        disabled={errorLogs.length === 0}
                                        className="flex items-center justify-center gap-2 px-5 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 rounded-xl text-xs font-black transition-all active:scale-[0.98] shadow-sm shrink-0"
                                    >
                                        <Trash2 size={14} /> Clear Error Logs
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden w-full">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4 w-10"></th>
                                                <th className="px-6 py-4">Timestamp</th>
                                                <th className="px-6 py-4">Category</th>
                                                <th className="px-6 py-4">Error Message</th>
                                                <th className="px-6 py-4">Candidate / Session</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredErrors.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium bg-slate-50/20">
                                                        No captured errors matching filter criteria.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredErrors.map((err) => {
                                                    const isExpanded = expandedErrorId === err.id;
                                                    return (
                                                        <React.Fragment key={err.id}>
                                                            <tr 
                                                                onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                                                                className="hover:bg-slate-50/40 cursor-pointer transition-colors"
                                                            >
                                                                <td className="px-6 py-4 text-slate-400">
                                                                    {isExpanded ? '▼' : '▶'}
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                                                    {new Date(err.timestamp).toLocaleDateString()} {new Date(err.timestamp).toLocaleTimeString()}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${
                                                                        err.category === 'database' ? 'bg-red-100 text-red-800' :
                                                                        err.category === 'api' ? 'bg-purple-100 text-purple-800' :
                                                                        err.category === 'proctoring' ? 'bg-amber-100 text-amber-800' :
                                                                        err.category === 'interview' ? 'bg-blue-100 text-blue-800' :
                                                                        err.category === 'evaluation' ? 'bg-indigo-100 text-indigo-800' :
                                                                        'bg-slate-100 text-slate-800'
                                                                    }`}>
                                                                        {err.category}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-800 font-medium max-w-sm overflow-hidden text-ellipsis">
                                                                    {err.message}
                                                                </td>
                                                                <td className="px-6 py-4 text-slate-500 text-xs">
                                                                    {err.candidateName ? (
                                                                        <div>
                                                                            <span className="font-semibold">{err.candidateName}</span>
                                                                            {err.sessionId && <span className="text-[10px] text-slate-400 block font-mono">Session: {err.sessionId.substring(0, 8)}...</span>}
                                                                        </div>
                                                                    ) : err.sessionId ? (
                                                                        <span className="font-mono">ID: {err.sessionId.substring(0, 8)}...</span>
                                                                    ) : (
                                                                        <span className="text-slate-300">N/A</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr>
                                                                    <td colSpan={5} className="px-8 py-4 bg-slate-900 text-red-400 font-mono text-xs border-l-4 border-l-red-500">
                                                                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800 text-slate-500">
                                                                            <span>Exception Context Details</span>
                                                                            <button 
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    navigator.clipboard.writeText(err.details || '');
                                                                                }}
                                                                                className="hover:text-white px-2 py-0.5 bg-slate-800 rounded hover:bg-slate-700 transition-all"
                                                                            >
                                                                                Copy Details
                                                                            </button>
                                                                        </div>
                                                                        <pre className="whitespace-pre-wrap max-h-60 overflow-y-auto font-mono">{err.details || "No technical details captured for this error."}</pre>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}



                </div>
            </main>

            {/* Confirmation Modals */}
            {showConfirmModal && sessionToConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 animate-in zoom-in-95 duration-200 text-left">
                        <div className="flex items-center gap-4 text-slate-800">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                showConfirmModal === 'delete' ? 'bg-red-105 text-red-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                                {showConfirmModal === 'delete' ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
                            </div>
                            <div>
                                <h3 className="font-extrabold text-base">
                                    {showConfirmModal === 'archive' && 'Archive Report'}
                                    {showConfirmModal === 'restore' && 'Restore Report'}
                                    {showConfirmModal === 'delete' && 'Permanent Delete'}
                                </h3>
                                <p className="text-slate-500 text-xs mt-0.5">{sessionToConfirm.candidate.name}</p>
                            </div>
                        </div>
                        
                        <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                            {showConfirmModal === 'archive' && 'Are you sure you want to archive this report? It will be moved to the Archived Reports filter.'}
                            {showConfirmModal === 'restore' && 'Are you sure you want to restore this report back to the active dashboard?'}
                            {showConfirmModal === 'delete' && 'Warning: This action is permanent and cannot be undone. All candidate responses, transcripts, and evaluation metrics will be deleted forever.'}
                        </p>
                        
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(null);
                                    setSessionToConfirm(null);
                                }}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (showConfirmModal === 'archive') {
                                        await SupabaseService.softDeleteSession(sessionToConfirm.id);
                                    } else if (showConfirmModal === 'restore') {
                                        await SupabaseService.restoreSession(sessionToConfirm.id);
                                    } else if (showConfirmModal === 'delete') {
                                        await SupabaseService.hardDeleteSession(sessionToConfirm.id);
                                    }
                                    setShowConfirmModal(null);
                                    setSessionToConfirm(null);
                                    loadSessionsAndErrors();
                                }}
                                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-[0.98] ${
                                    showConfirmModal === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {showConfirmModal === 'archive' && 'Archive'}
                                {showConfirmModal === 'restore' && 'Restore'}
                                {showConfirmModal === 'delete' && 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
