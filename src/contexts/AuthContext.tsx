import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** Vrai tant que la session initiale n'a pas été restaurée depuis le stockage. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Rend `needsEmailConfirmation` à vrai quand le projet Supabase exige une
   * confirmation : dans ce cas aucune session n'est ouverte, et l'interface
   * doit inviter à consulter la boîte mail plutôt que de rediriger.
   */
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    // Couvre la connexion, la déconnexion et le rafraîchissement de jeton,
    // y compris lorsqu'ils viennent d'un autre onglet.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Lu par le trigger `handle_new_user` pour initialiser le profil.
        data: { display_name: displayName },
        // Destination du lien de confirmation. Doit figurer dans les
        // « Redirect URLs » du projet Supabase, sinon le lien retombe sur
        // l'URL du site par défaut.
        emailRedirectTo: `${window.location.origin}/connexion`,
      },
    });
    if (error) throw error;

    // Supabase ne renvoie une session que si la confirmation est désactivée.
    return { needsEmailConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, isLoading, signIn, signUp, signOut }),
    [session, isLoading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
