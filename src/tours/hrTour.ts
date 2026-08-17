

/**
 * HR / Recruiter Tour Steps
 *
 * Add these data-tour attributes to your HR components:
 *
 * data-tour="hr-role-card"         → HR card in RoleLandingPage.tsx
 * data-tour="hr-overview-tab"      → Overview tab in HRDashboard
 * data-tour="hr-candidates-tab"    → Candidates tab
 * data-tour="hr-reports-tab"       → Reports tab
 * data-tour="hr-drives-tab"        → My Drives tab
 * data-tour="new-drive-btn"        → New Drive button inside My Drives
 * data-tour="hr-assignments-tab"   → Assignments tab
 */

export const hrTourSteps = [
  {
    id: "welcome-hr",
    title: "👋 Welcome, Recruiter!",
    text: "<p>This tour walks you through the HR dashboard. Each step highlights a tab in the top navigation bar.</p>",
  },
  {
    id: "overview-tab",
    title: "Step 1 — Overview",
    text: "<p>This is your home screen. See active drives, total candidates, interviews completed, and average score at a glance. Expand any drive to see individual candidates.</p>",
    attachTo: { element: '[data-tour="hr-overview-tab"]', on: "bottom" },
  },
  {
    id: "candidates-tab",
    title: "Step 2 — Candidates",
    text: "<p>View all candidates across every drive in one table. See their status, score, and completion date. Click any row with a completed session to view their report.</p>",
    attachTo: { element: '[data-tour="hr-candidates-tab"]', on: "bottom" },
  },
  {
    id: "reports-tab",
    title: "Step 3 — Reports",
    text: "<p>All completed interviews appear here as report cards. Click any card to open the full AI evaluation — scores, strengths, weaknesses, and your shortlist/reject decision.</p>",
    attachTo: { element: '[data-tour="hr-reports-tab"]', on: "bottom" },
  },
  {
    id: "drives-tab",
    title: "Step 4 — My Drives",
    text: "<p>All your interview drives are listed here. You can activate, complete, or archive a drive. Use <strong>Get Link</strong> to copy the candidate join link.</p>",
    attachTo: { element: '[data-tour="hr-drives-tab"]', on: "bottom" },
  },
  {
    id: "new-drive",
    title: "Step 5 — Create a New Drive",
    text: "<p>Click <strong>New Drive</strong> (located in the my drives tab) to set up a new interview batch for a role. Give it a title, set the status to Active, then share the link with candidates.</p>",
    attachTo: { element: '[data-tour="new-drive-btn"]', on: "bottom" },
  },
  {
    id: "assignments-tab",
    title: "Step 6 — Assignments",
    text: "<p>Use this tab to directly assign interviews to specific candidates by email — no access key needed on their end. Set a deadline and max attempts.</p>",
    attachTo: { element: '[data-tour="hr-assignments-tab"]', on: "bottom" },
  },
  {
    id: "activate-drive",
    title: "⚡ Most Important — Activate Your Drive",
    text: "<p>A drive in <strong>DRAFT</strong> status is invisible to candidates. Go to My Drives and click <strong>Activate</strong> to go live. Candidates can only join active drives.</p>",
  },
  {
    id: "done-hr",
    title: "You're ready to hire! 🚀",
    text: "<p>That covers the full recruiter flow. Create a drive → activate it → share the link → review AI reports as results come in.</p><p style='margin-top:8px; font-size:0.85em; color:#888;'>Replay this tour anytime from the <strong>?</strong> button.</p>",
  },
];