import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata = { title: "Reset your password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </Link>
        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <h1 className="text-2xl font-black">Reset your password</h1>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            Enter the email on your account and we will send you a link to set a
            new password.
          </p>
          {sp.expired === "1" ? (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              That link has expired or has already been used. Request a new one
              below.
            </div>
          ) : null}
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--brand-slate)]">
          Remembered it?{" "}
          <Link href="/login" className="text-[var(--brand-red)] font-bold">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
