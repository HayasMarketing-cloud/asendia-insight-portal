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
  console.log("[diag:useProfile] auth user", { id: user?.id, email: user?.email });
  if (!user) return null;

  const profileRes = await supabase
    .from("profiles")
    .select("id, account_id, role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  console.log("[diag:useProfile] profile query", {
    data: profileRes.data,
    error: profileRes.error,
    status: profileRes.status,
  });
  if (profileRes.error) throw profileRes.error;
  const profile = profileRes.data;
  if (!profile) return { profile: null, account: null };

  let account: Account | null = null;
  if (profile.account_id) {
    const accRes = await supabase
      .from("accounts")
      .select("id, name, slug")
      .eq("id", profile.account_id)
      .maybeSingle();
    console.log("[diag:useProfile] accounts by id", {
      data: accRes.data,
      error: accRes.error,
      status: accRes.status,
    });
    account = accRes.data;
  } else if (profile.role === "hayas_admin") {
    const accsRes = await supabase
      .from("accounts")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .limit(1);
    console.log("[diag:useProfile] accounts fallback (hayas_admin)", {
      data: accsRes.data,
      error: accsRes.error,
      status: accsRes.status,
      count: accsRes.data?.length,
    });
    account = accsRes.data?.[0] ?? null;
  } else {
    console.log("[diag:useProfile] no account_id and role is not hayas_admin", {
      role: profile.role,
    });
  }
  console.log("[diag:useProfile] resolved", {
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
  });
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
