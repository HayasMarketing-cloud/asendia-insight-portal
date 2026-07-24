import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, ClipboardCheck, LogOut, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/leads", label: "Lead Ranking", icon: Target },
  { to: "/manual-review", label: "Manual Review", icon: ClipboardCheck },
  { to: "/kpis", label: "KPIs", icon: BarChart3 },
  { to: "/ops", label: "Ops Health", icon: Activity },
] as const;

export function PortalShell() {
  const { account, profile } = useActiveAccount();
  const state = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-6 py-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/60">
            Hayas Marketing
          </div>
          <div className="mt-1 text-lg font-semibold">Client Portal</div>
          {account && (
            <div className="mt-3 rounded-md bg-sidebar-accent px-3 py-2 text-sm">
              <div className="text-sidebar-foreground/60 text-[10px] uppercase tracking-wider">
                Account
              </div>
              <div className="font-medium text-sidebar-accent-foreground">
                {account.name}
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4">
          <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Lead Accelerator
          </div>
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = state.startsWith(item.to);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 text-xs">
            <div className="truncate text-sidebar-foreground/60">
              {profile?.email}
            </div>
            {profile?.role && (
              <div className="mt-0.5 inline-block rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-sidebar-accent-foreground">
                {profile.role}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
