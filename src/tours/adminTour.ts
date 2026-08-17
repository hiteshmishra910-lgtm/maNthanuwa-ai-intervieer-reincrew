

/**
 * Admin Tour Steps
 *
 * Add these data-tour attributes to your Admin components:
 *
 * data-tour="admin-role-card"       → Admin card in RoleLandingPage.tsx
 * data-tour="admin-users-table"     → Table/list of admin_users
 * data-tour="add-hr-btn"            → Button to add a new HR user
 * data-tour="sessions-panel"        → Live / past interview sessions list
 * data-tour="system-settings-link"  → Link/nav item to system settings
 * data-tour="api-key-field"         → OpenRouter or other API key config field
 * data-tour="proctoring-logs"       → Proctoring events / media panel
 */

export const adminTourSteps = [
  {
    id: "welcome-admin",
    title: "🛡️ Admin Tour",
    text: "<p>This tour covers everything you can control as an administrator. Each step highlights a section in the sidebar.</p>",
  },
  {
    id: "dashboard-nav",
    title: "Step 1 — Dashboard Overview",
    text: "<p>This is your home screen — see total interviews, flagged candidates, average scores, and a 7-day activity chart at a glance.</p>",
    attachTo: { element: '[data-tour="admin-dashboard-nav"]', on: "right" },
  },
  {
    id: "candidates-nav",
    title: "Step 2 — Evaluation Reports",
    text: "<p>Click here to see every candidate session. Click any name to view their full AI evaluation report, download a PDF, or archive the record.</p>",
    attachTo: { element: '[data-tour="admin-candidates-nav"]', on: "right" },
  },
  {
    id: "questions-nav",
    title: "Step 3 — Interview Flow Editor",
    text: "<p>Edit the question bank for each role, configure difficulty strategy, and set proctoring rules per interview drive.</p>",
    attachTo: { element: '[data-tour="admin-questions-nav"]', on: "right" },
  },
  {
    id: "proctoring-nav",
    title: "Step 4 — Proctoring Settings",
    text: "<p>Configure warning and termination thresholds — tab switches, face detection, camera off rules — that apply to all live interviews.</p>",
    attachTo: { element: '[data-tour="admin-proctoring-nav"]', on: "right" },
  },
  {
    id: "system-nav",
    title: "Step 5 — System Health",
    text: "<p>Check database connectivity, token usage, and browser STT compatibility. Use this if candidates report issues during interviews.</p>",
    attachTo: { element: '[data-tour="admin-system-nav"]', on: "right" },
  },
  {
    id: "errors-nav",
    title: "Step 6 — Error Logs",
    text: "<p>All runtime exceptions are captured here — database errors, API failures, proctoring issues. Use this for debugging.</p>",
    attachTo: { element: '[data-tour="admin-errors-nav"]', on: "right" },
  },
  {
    id: "done-admin",
    title: "Admin setup complete ✓",
    text: "<p>You now know all the admin controls. Any config change here affects all HR users and active interview sessions.</p><p style='margin-top:8px; font-size:0.85em; color:#888;'>Replay this tour anytime from the <strong>?</strong> button.</p>",
  },
];