import { redirect } from "next/navigation";
import { CertlyMark } from "@/components/CertlyMark";
import { createClient } from "@/lib/supabase/server";
import SetPasswordForm from "./SetPasswordForm";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; change?: string }>;
}) {
  const sp = await searchParams;
  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isChange = sp.change === "1";

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </div>
        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          <h1 className="text-2xl font-black">
            {isChange ? "Change your password" : "Set your password"}
          </h1>
          <p className="mt-1 text-sm text-[var(--brand-slate)]">
            {isChange
              ? "Choose a new password for your account."
              : "Choose a password to finish setting up your account."}
          </p>
          <div className="mt-6">
            <SetPasswordForm next={sp.next} />
          </div>
        </div>
      </div>
    </main>
  );
}
