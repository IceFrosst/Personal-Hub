import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon, manifest, icons, sw.js (static PWA assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg)$).*)",
  ],
};
