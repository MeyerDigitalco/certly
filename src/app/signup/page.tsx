import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import SignupForm from "./SignupForm";

export const metadata = {
  title: "Create your workspace",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <Link href="/" className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </Link>
        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <h1 className="text-2xl font-black">Create your workspace</h1>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            Fourteen days free, no card. You become the workspace owner.
          </p>
          <div className="mt-6">
            <SignupForm />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--brand-slate)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--brand-red)] font-bold">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
