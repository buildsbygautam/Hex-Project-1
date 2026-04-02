import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { type User, type Session } from '@supabase/supabase-js';
import { supabase, authFunctions, type UserProfile } from '@/lib/supabase';

interface DailyUsage {
  messageCount: number;
  canSendMessage: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  dailyUsage: DailyUsage;
  isAuthenticated: boolean;
  isPremium: boolean;
  canSendMessage: boolean;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  incrementUsage: () => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global flag to prevent multiple simultaneous loadUserData calls
let isLoadingUserData = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>({ messageCount: 0, canSendMessage: true });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id);
      }

      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setProfile(null);
        setDailyUsage({ messageCount: 0, canSendMessage: true });
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    if (isLoadingUserData) return;
    isLoadingUserData = true;

    try {
      const [profileResult, usageResult] = await Promise.all([
        authFunctions.getUserProfile(userId),
        authFunctions.getDailyUsage(userId)
      ]);

      if (profileResult.profile) setProfile(profileResult.profile);
      setDailyUsage({
        messageCount: usageResult.messageCount,
        canSendMessage: usageResult.canSendMessage
      });
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      isLoadingUserData = false;
    }
  };

  const signInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin + '/auth/callback'
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const incrementUsage = async () => {
    if (!user) return false;

    console.log('🔄 Incrementing global usage for:', user.id);
    const { success } = await authFunctions.incrementDailyUsage(user.id);
    
    // Immediately refresh state
    await refreshUsage();
    return success;
  };

  const refreshProfile = async () => {
    if (user) {
      const { profile } = await authFunctions.getUserProfile(user.id);
      if (profile) setProfile(profile);
    }
  };

  const refreshUsage = async () => {
    if (user) {
      const usageResult = await authFunctions.getDailyUsage(user.id);
      setDailyUsage({
        messageCount: usageResult.messageCount,
        canSendMessage: usageResult.canSendMessage
      });
      console.log('📊 Global usage state updated:', usageResult.messageCount);
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    dailyUsage,
    isAuthenticated: !!session,
    isPremium: profile?.subscription_status === 'premium',
    canSendMessage: dailyUsage.canSendMessage,
    signInWithGitHub,
    signOut,
    incrementUsage,
    refreshProfile,
    refreshUsage
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
