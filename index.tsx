import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './styles/global.css';
import App from './App';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);

if (!PUBLISHABLE_KEY) {
  // RENDER FALLBACK UI INSTEAD OF CRASHING
  root.render(
    <React.StrictMode>
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
        <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-red-100">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Setup Required 🚀</h1>
          <p className="text-slate-600 mb-6">
            The application is missing its <strong>Clerk Publishable Key</strong>.
            This usually happens after deploying to a new environment without setting up Environment Variables.
          </p>
          <div className="bg-slate-50 p-4 rounded-lg mb-6 text-sm overflow-x-auto text-slate-700">
            <p className="font-mono">1. Go to your Hosting Provider (e.g. Vercel)</p>
            <p className="font-mono">2. Set VITE_CLERK_PUBLISHABLE_KEY</p>
            <p className="font-mono">3. Redeploy</p>
          </div>
          <p className="text-xs text-slate-400">
            Check your .env.local for development, or your hosting dashboard for production.
          </p>
        </div>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider 
        publishableKey={PUBLISHABLE_KEY} 
        afterSignOutUrl="/welcome"
        appearance={{
          elements: {
            rootBox: "w-full flex justify-center items-center mx-auto",
            cardBox: "w-full max-w-md mx-auto shadow-none border-0 bg-transparent flex flex-col items-center justify-center",
            card: "w-full max-w-md mx-auto shadow-none border-0 bg-transparent flex flex-col items-center justify-center text-center",
            headerTitle: "text-slate-900 font-extrabold text-xl text-center w-full",
            headerSubtitle: "text-slate-500 text-sm text-center w-full",
            formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all duration-200 w-full text-sm",
            socialButtonsBlockButton: "border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl py-2.5 transition-all w-full flex justify-center items-center gap-2",
            formFieldInput: "border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all w-full text-sm",
            footerActionLink: "text-indigo-600 hover:text-indigo-700 font-semibold text-sm",
          }
        }}
      >
        <App />
      </ClerkProvider>
    </React.StrictMode>
  );
}