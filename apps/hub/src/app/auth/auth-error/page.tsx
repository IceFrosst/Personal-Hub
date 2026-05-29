import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Sign-in didn&apos;t complete</h1>
        <p className="text-sm text-text-muted">
          Something went wrong handing the session back from Google. Try again.
        </p>
        <Link
          href="/"
          className="inline-block min-h-11 rounded-md bg-surface px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-surface-elevated"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
