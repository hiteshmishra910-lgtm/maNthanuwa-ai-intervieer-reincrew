import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../Core/database/supabaseClient';
import { Loader2 } from 'lucide-react';
import { TourButton } from "../tours/TourButton";

export const HRLayout: React.FC = () => {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Already on onboarding — don't check, just render
    if (location.pathname === '/hr/onboarding') {
      setChecking(false);
      return;
    }

    // Wait for Clerk to load
    if (!isLoaded) return;

    // Clerk loaded but no user — shouldn't happen due to RoleProtectedRoute, but handle it
    if (!user) {
      setChecking(false);
      return;
    }

    const checkOrg = async () => {
      try {
        const email = user.primaryEmailAddress?.emailAddress ?? '';
        const { data } = await supabase
          .from('organizations')
          .select('id')
          .eq('created_by', email)
          .maybeSingle();

        if (!data) {
          navigate('/hr/onboarding', { replace: true });
        }
      } catch (err) {
        console.error('[HRLayout] org check failed:', err);
      } finally {
        setChecking(false); // ALWAYS set checking to false
      }
    };

    checkOrg();
  }, [isLoaded, user, location.pathname, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-indigo-500/10 transition-colors duration-500">
      <Outlet />
      <TourButton role="hr" /> 
    </div>
  );
};