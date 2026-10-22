import Link from "next/link";
import { redirect } from "next/navigation";
import { CertlyMark } from "@/components/CertlyMark";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import LoginForm from "./LoginForm";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(safeRedirectPath(sp.next, "/workspace"));

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </Link>
        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <h1 className="text-2xl font-black">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            Welcome back. Enter your details to continue.
          </p>
          <div className="mt-6">
            <LoginForm next={sp.next} />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--brand-slate)]">
          <Link
            href="/forgot-password"
            className="text-[var(--brand-red)] font-bold"
          >
            Forgot your password?
          </Link>
        </p>
        <p className="mt-2 text-center text-sm text-[var(--brand-slate)]">
          New here?{" "}
          <Link href="/signup" className="text-[var(--brand-red)] font-bold">
            Create a workspace
          </Link>
        </p>
      </div>
    </main>
  );
}
