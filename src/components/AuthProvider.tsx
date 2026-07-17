"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth, googleProvider } from "@/lib/firebase-client";
import type { Role } from "@/lib/types";
import { toast } from "sonner";

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
}

interface AuthContextValue {
  firebaseUser: User | null;
  session: SessionUser | null;
  loading: boolean;
  /** Email d'un compte authentifié mais refusé (rôle blocked) — carte de refus standard */
  deniedEmail: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSession(data.user || null);
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    const auth = firebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFirebaseUser(u);
      if (!u) {
        await refreshSession();
        setLoading(false);
        return;
      }
      // Pas de blocage domaine côté client : la whitelist (users.invited) n'est
      // vérifiable que côté serveur. On délègue la décision à /api/session, qui
      // répond 200 (domaine OU whitelisté + rôle) ou 403 { blocked } → carte de
      // refus standard. Un externe non whitelisté est donc refusé par le serveur.
      try {
        const idToken = await u.getIdToken(true);
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          const data = await res.json();
          setSession(data.user || null);
          setDeniedEmail(null);
        } else {
          const err = await res.json().catch(() => ({}));
          if (res.status === 403 && err.blocked) {
            // Carte de refus standard (contrat recette) — pas de toast en doublon.
            setDeniedEmail(err.email || u.email || "");
          } else {
            console.error("[AuthProvider] session POST failed:", res.status);
            toast.error(
              err.error
                ? `${err.error}${err.detail ? ` (${err.detail})` : ""}`
                : `Session refusée (${res.status})`
            );
          }
          await fbSignOut(auth);
          setSession(null);
        }
      } catch (e) {
        console.error("[AuthProvider] unexpected error during session creation");
        setSession(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const auth = firebaseAuth();
    setDeniedEmail(null);
    try {
      await signInWithPopup(auth, googleProvider());
    } catch (e: any) {
      if (e?.code !== "auth/popup-closed-by-user") {
        toast.error(e?.message || "Échec de la connexion");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    // Le SDK accepte AUSSI le cookie hub __gandalf_session (.chanv.com) en
    // repli : sans le fermer côté hub, la session renaissait aussitôt et le
    // bouton Déconnexion « ne faisait rien » en standalone.
    try {
      await fetch(`${process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"}/api/sso/session`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      /* hub injoignable — la session app est quand même fermée */
    }
    await fbSignOut(firebaseAuth());
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ firebaseUser, session, loading, deniedEmail, signInWithGoogle, signOut, refreshSession }),
    [firebaseUser, session, loading, deniedEmail, signInWithGoogle, signOut, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
