import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role: Role) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        setSession(newSession);
        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const lower = email.toLowerCase().trim();
    const demoRoles: Record<string, { role: Role; name: string }> = {
      'admin@erpcrm.com': { role: 'admin', name: 'System Admin' },
      'sales@erpcrm.com': { role: 'sales', name: 'Sales Representative' },
      'warehouse@erpcrm.com': { role: 'warehouse', name: 'Warehouse Manager' },
      'accounts@erpcrm.com': { role: 'accounts', name: 'Accounts Specialist' },
    };

    if (demoRoles[lower]) {
      const demo = demoRoles[lower];
      const mockSession = {
        access_token: `demo-token-${demo.role}`,
        user: { id: `demo-${demo.role}`, email: lower } as any,
      } as Session;
      const mockProfile: Profile = {
        id: `demo-${demo.role}`,
        full_name: demo.name,
        role: demo.role,
        created_at: new Date().toISOString(),
      };
      setSession(mockSession);
      setProfile(mockProfile);
      localStorage.setItem('verve_jwt_token', `demo-jwt-${demo.role}`);
      return { error: null };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Invalid email or password.' };
    if (data.session) {
      localStorage.setItem('verve_jwt_token', data.session.access_token);
    }
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string, role: Role) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) return { error: 'Could not create the account. ' + error.message };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        role,
      });
    }
    if (data.session) {
      localStorage.setItem('verve_jwt_token', data.session.access_token);
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem('verve_jwt_token');
    setProfile(null);
    setSession(null);
  }


  return (
    <AuthContext.Provider value={{ session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
