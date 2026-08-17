import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase, setSupabaseAuthToken, setClerkToken } from '../Core/database/supabaseClient';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[]; // e.g., ['admin', 'hr']
}

/**
 * UI convenience route guard only.
 * Hiding UI routes in the browser provides layout/UX navigation control.
 * Database Row Level Security (RLS) policies and Edge Function authorization checks
 * serve as the actual security boundary protecting admin endpoints and data.
 */
export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const location = useLocation();

  const [userRole, setUserRole] = useState<string | null>(null);
  const [isRoleChecked, setIsRoleChecked] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user || !isSignedIn || !isLoaded) {
        setUserRole(null);
        setIsRoleChecked(true);
        return;
      }

      try {
        let token: string | null = null;
        let rawClerkToken: string | null = null;
        try {
          rawClerkToken = await getToken();   // raw Clerk JWT for edge functions
          token = await getToken({ template: 'supabase' });
        } catch {
          token = rawClerkToken;
        }
        setClerkToken(rawClerkToken);         // store for edge function auth
        if (token) setSupabaseAuthToken(token);

        const currentEmail = (user.primaryEmailAddress?.emailAddress || '').trim();
        const { data, error } = await supabase
          .from('admin_users')
          .select('role')
          .ilike('email', currentEmail)
          .maybeSingle();

        if (error || !data) {
          setUserRole(null);
        } else {
          setUserRole(data.role);
        }
      } catch (err) {
        setUserRole(null);
      }

      setIsRoleChecked(true);
    };

    fetchRole();
  }, [user, isSignedIn, isLoaded, getToken]);

  if (!isLoaded || !isRoleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />; // Or to an unauthorized page
  }

  return <>{children}</>;
};
