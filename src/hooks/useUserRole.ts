import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { supabase, setSupabaseAuthToken, setClerkToken } from '../Core/database/supabaseClient';

export function useUserRole() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { user } = useUser();
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

  return { userRole, isRoleChecked };
}
