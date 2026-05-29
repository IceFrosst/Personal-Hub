import SignInWithGoogle from "./SignInWithGoogle";

export default function SignInLanding() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-between px-4 py-6"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex-1" />

      <div className="w-full max-w-sm space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Personal Apps</h1>
        <p className="text-sm text-text-muted">
          Sign in to launch any of your apps.
        </p>
      </div>

      <div className="mt-8 w-full max-w-sm">
        <SignInWithGoogle />
      </div>

      <div className="flex-1" />
    </main>
  );
}
