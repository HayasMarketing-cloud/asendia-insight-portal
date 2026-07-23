import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  account_id: string | null;
  role: "viewer" | "admin" | "hayas_admin";
  full_name: string | null;
  email: string;
};

export type Account = {
  id: string;
  name: string;
  slug: string;
};

async function fetchProfileWithAccount() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, account_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return { profile: null, account: null };

  let account: Account | null = null;
  if (profile.account_id) {
    const { data: acc } = await supabase
      .from("accounts")
      .select("id, name, slug")
      .eq("id", profile.account_id)
      .maybeSingle();
    account = acc;
  } else if (profile.role === "hayas_admin") {
    // Phase 1: hayas_admins are cross-account with no switcher yet.
    // Default to the first (and currently only) account. RLS lets hayas_admins
    // see all accounts. Future: replace with a stored selection.
    const { data: accs } = await supabase
      .from("accounts")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(1);
    account = accs?.[0] ?? null;
  }
  return { profile: profile as Profile, account };
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfileWithAccount,
    staleTime: 60_000,
  });
}

/**
 * Phase 1: returns the profile's account. Future: swap in a stored
 * selection for hayas_admin users with multiple accounts.
 */
export function useActiveAccount() {
  const { data, isLoading } = useProfile();
  return {
    account: data?.account ?? null,
    accountId: data?.account?.id ?? null,
    profile: data?.profile ?? null,
    isLoading,
  };
}
