import React from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export const PublicRoute: React.FC<{ children: React.ReactNode; restricted?: boolean }> = ({ children, restricted = false }) => {
  const { isSignedIn, isLoaded } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // If restricted is true, authenticated users shouldn't access this route (e.g., login page)
  if (isSignedIn && restricted) {
    // If they have a "from" location in state, send them back there, else default to /candidate/dashboard
    const from = (location.state as any)?.from?.pathname || '/welcome';
    if (from === location.pathname) {
      return <Navigate to="/welcome" replace />;
    }
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
};
