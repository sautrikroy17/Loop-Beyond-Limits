import { create } from "zustand";
import { supabase } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isLoggedIn: false,
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Initialize auth listener
export const initAuthListener = () => {
  const { setUser, setSession, setLoading } = useAuth.getState();

  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);

    if (session?.user) {
      // Load profile (avatar, display name)
      import("./useUserProfile").then(({ useUserProfile }) => {
        useUserProfile
          .getState()
          .loadFromCloud(session.user.id, session.user.user_metadata?.avatar_url);
      });
      // Load listening intelligence
      import("@/functions/profile").then(({ loadProfileFn }) => {
        loadProfileFn();
      });
      // Restore last played track from cloud (runs once, idempotent)
      import("@/lib/supabase/playbackSync").then(({ initPlaybackSync }) => {
        initPlaybackSync(session.user.id);
      });
    }
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);

    if (event === "SIGNED_IN" && session?.user) {
      import("./useUserProfile").then(({ useUserProfile }) => {
        useUserProfile
          .getState()
          .loadFromCloud(session.user.id, session.user.user_metadata?.avatar_url);
      });
      import("@/functions/profile").then(({ loadProfileFn }) => {
        loadProfileFn();
      });
      import("@/lib/supabase/playbackSync").then(({ initPlaybackSync }) => {
        initPlaybackSync(session.user.id);
      });
    }

    if (event === "SIGNED_OUT") {
      // Clear local data so next user starts fresh
      import("./useUserProfile").then(({ useUserProfile }) => {
        useUserProfile.getState().clearLocalData();
      });
      import("@/lib/supabase/playbackSync").then(({ stopPlaybackSync }) => {
        stopPlaybackSync();
      });
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};
