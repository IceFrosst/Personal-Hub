import type { User } from "@supabase/supabase-js";
import { getApps } from "@/lib/apps";
import AppGrid from "./AppGrid";
import SignOutButton from "./SignOutButton";

export default function HubHome({ user }: { user: User }) {
  const apps = getApps();
  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1rem, env(safe-area-inset-left))",
        paddingRight: "max(1rem, env(safe-area-inset-right))",
      }}
    >
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Personal Apps</h1>
          {displayName ? (
            <p className="mt-1 text-sm text-text-muted">{displayName}</p>
          ) : null}
        </div>
        <SignOutButton />
      </header>

      <section>{apps.length === 0 ? <EmptyState /> : <AppGrid apps={apps} />}</section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center">
      <p className="text-sm text-text-muted">
        No apps yet. Add one in <code className="text-text">config/apps.json</code>.
      </p>
    </div>
  );
}
