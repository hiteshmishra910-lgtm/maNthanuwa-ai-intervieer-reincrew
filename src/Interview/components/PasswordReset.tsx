import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

export const PasswordReset: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { signIn, isLoaded } = useSignIn();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isLoaded) {
    return <div className="text-center py-8 text-slate-500">Loading...</div>;
  }

  // STEP 1: Send reset code to email
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn?.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setStep('code');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to send reset code. Check your email.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: Verify the code
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn?.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code,
      });
      setStep('password');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: Set new password
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn?.resetPassword({ password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to reset password. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Password Reset!</h3>
        <p className="text-slate-500 mb-6 text-sm">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <button
          onClick={onBack}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-2xl transition"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-xl transition"
        >
          <ArrowLeft size={18} className="text-slate-500" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
          <p className="text-slate-500 text-sm">
            {step === 'email' && 'Enter your email to receive a reset code'}
            {step === 'code' && `Code sent to ${email}`}
            {step === 'password' && 'Create your new password'}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex gap-2 mb-6">
        <div className="h-1.5 flex-1 rounded-full bg-indigo-600"></div>
        <div className={`h-1.5 flex-1 rounded-full ${step === 'code' || step === 'password' ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
        <div className={`h-1.5 flex-1 rounded-full ${step === 'password' ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-2xl text-sm mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* STEP 1: Email */}
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="john@example.com"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send Reset Code'}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>
      )}

      {/* STEP 2: Code */}
      {step === 'code' && (
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
              Verification Code
            </label>
            <input
              type="text"
              placeholder="000000"
                aria-label="6-digit verification code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              required
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300 text-center text-2xl tracking-[0.5em] font-mono"
            />
            <p className="text-xs text-slate-400 mt-2 text-center">
              Check your inbox and spam folder
            </p>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
            {!isLoading && <ArrowRight size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition"
          >
            Didn't receive code? Go back
          </button>
        </form>
      )}

      {/* STEP 3: New Password */}
      {step === 'password' && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
              New Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="At least 8 characters"
                aria-label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2 block">
              Confirm Password
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="Re-enter your password"
                aria-label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-12 pr-4 py-4 rounded-2xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Resetting...' : 'Set New Password'}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>
      )}
    </div>
  );
};