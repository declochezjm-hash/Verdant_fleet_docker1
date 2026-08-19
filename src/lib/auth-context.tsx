import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toast } from "sonner";

export type AppRole = "agent" | "coordinator" | "admin";

interface Profile { id: string; name: string; team: string | null; is_blocked?: boolean | null }
interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      else setLoading(false);
    }).catch((error) => {
      console.error("Erreur de session Supabase :", error);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid: string) => {
    try {
      const [{ data: p, error: profileError }, { data: r, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("id,name,team,is_blocked").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);

      if (profileError) {
        console.error("Erreur de chargement du profil :", profileError);
      }
      if (rolesError) {
        console.error("Erreur de chargement des rôles :", rolesError);
      }

      if (p?.is_blocked) {
        await supabase.auth.signOut();
        toast.error("Votre compte a été suspendu par l'administration.");
        return;
      }

      setProfile(p ?? null);
      setRoles((r ?? []).map((x) => x.role as AppRole));
    } catch (error) {
      console.error("Erreur inattendue lors du chargement du profil :", error);
      setProfile(null);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const primaryRole: AppRole | null = roles.includes("admin") ? "admin"
    : roles.includes("coordinator") ? "coordinator"
    : roles.includes("agent") ? "agent" : null;

  return (
    <Ctx.Provider value={{
      session, user: session?.user ?? null, profile, roles, primaryRole, loading,
      signOut: async () => { await supabase.auth.signOut(); },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
