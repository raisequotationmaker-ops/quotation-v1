import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-background" />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-[38%] bg-secondary md:block"
        aria-hidden
      />
      <div className="w-full max-w-md space-y-6">
        <div>
          <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            RAISE Lab Equipment
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-foreground">
            Quotation Maker
          </h1>
        </div>
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">Loading…</div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
