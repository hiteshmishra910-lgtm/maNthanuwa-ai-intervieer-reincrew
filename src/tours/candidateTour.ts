/**
 * Candidate Tour Steps
 *
 * Each `attachTo.element` must match a CSS selector or data attribute
 * that exists on your page. Use data-tour="..." attributes on your
 * JSX elements for reliable targeting (see comments below each step).
 *
 * Add  data-tour="candidate-role-card"  to the Candidate card in RoleLandingPage.tsx
 * Add  data-tour="practice-btn"         to the Practice Interview button
 * Add  data-tour="interview-access-key" to the access key input
 * Add  data-tour="start-interview-btn"  to the Start Interview button
 * Add  data-tour="camera-check"         to the camera preflight section
 */

export const candidateTourSteps= [
  {
    id: "welcome",
    title: "👋 Welcome to Project.AI",
    text: `
      <p>This quick tour shows you how to set up and run your interview. 
      It takes about 60 seconds — you can skip anytime.</p>
    `,
    // No attachTo — this is a floating welcome modal
  },
  {
    id: "role-card",
    title: "Step 1 — Choose your role",
    text: `
      <p>Click <strong>Student / Candidate</strong> to enter the candidate portal. 
      Your role is verified automatically from your login.</p>
    `,
    attachTo: { element: '[data-tour="candidate-role-card"]', on: "bottom" },
  },
  {
    id: "practice-interview",
    title: "Step 2 — Try a Practice Interview",
    text: `
      <p>New here? Use <strong>Practice Interview</strong> to try a real interview flow 
      without it counting. No access key needed — just click and go.</p>
    `,
    attachTo: { element: '[data-tour="practice-btn"]', on: "right" },
  },
  {
    id: "access-key",
    title: "Step 3 — Enter your Access Key",
    text: `
      <p>For a real interview, paste the <strong>access key</strong> sent to you by your recruiter. 
      Each key is unique to your interview session.</p>
    `,
    attachTo: { element: '[data-tour="interview-access-key"]', on: "bottom" },
  },
  {
    id: "camera-check",
    title: "Step 4 — Camera & Mic Check",
    text: `
      <p>Before the interview starts, you'll see a <strong>preflight check</strong>. 
      Allow camera and microphone access when your browser asks — 
      this is required for the proctoring system.</p>
    `,
    attachTo: { element: '[data-tour="camera-check"]', on: "bottom" },
  },
  {
    id: "start-interview",
    title: "Step 5 — Start your Interview",
    text: `
      <p>When you're ready, click <strong>Start Interview</strong>. 
      The AI will guide you through each question. 
      Don't close the tab mid-session — your progress is saved automatically.</p>
    `,
    attachTo: { element: '[data-tour="start-interview-btn"]', on: "top" },
  },
  {
    id: "done",
    title: "You're all set! 🎉",
    text: `
      <p>That's the full candidate flow. Good luck with your interview!</p>
      <p style="margin-top:8px; font-size:0.85em; color:#888;">
        You can replay this tour anytime from the <strong>Help</strong> button.
      </p>
    `,
    // Floating final card
  },
];