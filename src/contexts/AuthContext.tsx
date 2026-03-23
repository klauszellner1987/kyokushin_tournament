import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import idb from '../db';

interface LocalUser {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: User | LocalUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLocalMode: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const SKIP_AUTH =
  (import.meta.env.DEV && import.meta.env.VITE_SKIP_AUTH === 'true') ||
  import.meta.env.VITE_TESTING_MODE === 'true';

const TEST_USER: LocalUser = { uid: 'test_user', email: 'tester@demo', displayName: 'Tester' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | LocalUser | null>(SKIP_AUTH ? TEST_USER : null);
  const [loading, setLoading] = useState(!SKIP_AUTH);
  const isLocalMode = !isFirebaseConfigured;

  useEffect(() => {
    if (SKIP_AUTH) return;

    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
      });
      return unsubscribe;
    }

    // Local mode: check IndexedDB for stored user
    idb.documents
      .where({ _collection: '_auth' })
      .first()
      .then((doc) => {
        if (doc) {
          setUser({ uid: doc.id, email: doc.email as string, displayName: doc.displayName as string });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    if (auth) {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    }

    // Local mode: check stored credentials
    const existing = await idb.documents
      .where({ _collection: '_auth' })
      .filter((d) => d.email === email && d.password === password)
      .first();

    if (!existing) throw new Error('Kein Konto gefunden. Wechsle zu "Registrieren" um ein neues Konto zu erstellen.');
    setUser({ uid: existing.id, email: existing.email as string, displayName: existing.displayName as string });
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    if (auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      return;
    }

    // Local mode: store in IndexedDB
    const existing = await idb.documents
      .where({ _collection: '_auth' })
      .filter((d) => d.email === email)
      .first();

    if (existing) throw new Error('E-Mail bereits registriert');

    const id = `user_${Date.now()}`;
    await idb.documents.add({ _collection: '_auth', id, email, password, displayName } as never);
    setUser({ uid: id, email, displayName });
  };

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, isLocalMode }}>
      {children}
    </AuthContext.Provider>
  );
}
