import { createClient } from "@/lib/supabase/server";
import SignInLanding from "@/components/SignInLanding";
import HubHome from "@/components/HubHome";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SignInLanding />;
  }

  return <HubHome user={user} />;
}
