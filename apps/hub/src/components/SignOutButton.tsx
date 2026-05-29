"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLogout } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label="Sign out"
      className="flex min-h-11 min-w-11 items-center justify-center rounded-md bg-surface text-text-muted transition-colors hover:bg-surface-elevated hover:text-text disabled:opacity-60"
    >
      <IconLogout size={20} stroke={1.5} />
    </button>
  );
}
