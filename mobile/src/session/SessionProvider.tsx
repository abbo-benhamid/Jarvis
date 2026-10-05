import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, type Session } from '@/api';

type SessionValue = {
  session: Session | null;
  connecter: (telephone: string, code: string) => Promise<void>;
  deconnecter: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * Session en mémoire (lot M1).
 * Lot M2 : jetons dans expo-secure-store, rotation, effacement des données locales à la déconnexion.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const connecter = useCallback(async (telephone: string, code: string) => {
    setSession(await api.connecter(telephone, code));
  }, []);

  const deconnecter = useCallback(async () => {
    await api.deconnecter();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, connecter, deconnecter }), [session, connecter, deconnecter]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession doit être utilisé dans <SessionProvider>.');
  return v;
}
