/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { CertlyMark } from "@/components/CertlyMark";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken, inviteState } from "@/lib/invitations";
import { findAuthUserByEmail } from "@/lib/auth-users";
import InviteButtons from "./InviteButtons";
import CreateAccountForm from "./CreateAccountForm";



export const metadata = {
  title: "Invitation",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function article(role: string): string {
  return /^[aeiou]/i.test(role) ? "an" : "a";
}

const ROLE_DESCRIPTION: Record<string, string> = {
  owner: "full control, including billing and closing the workspace",
  admin: "adding and changing employees and certificates",
  viewer: "reading the register, with no ability to change anything",
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const supabase: any = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin: any = createAdminClient();
  const { data: invite } = await admin
    .from("invitations")
    .select(
      "organisation_id, email, role, expires_at, accepted_at, revoked_at",
    )
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  const state = inviteState(invite ?? null, user?.email ?? null);

  let orgName = "a Certly workspace";
  if (invite) {
    const { data: org } = await admin
      .from("organisations")
      .select("name")
      .eq("id", invite.organisation_id)
      .maybeSingle();
    if (org?.name) orgName = org.name;
  }

  // Which screen a signed out visitor gets turns on whether the invited
  // address already has a Certly account. Somebody new needs to choose a
  // password; somebody who already has one must sign in, because a forwarded
  // link must never be a way to set a password on an existing account.
  const hasAccount =
    state === "valid" && !user
      ? (await findAuthUserByEmail(admin, invite.email)) !== null
      : false;

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center">
          <CertlyMark size={26} />
          <span className="font-black text-xl tracking-tight">Certly</span>
        </Link>

        <div className="mt-6 bg-white border border-[var(--brand-line)] rounded-2xl p-8">
          {state === "valid" && !user && !hasAccount ? (
            <>
              <h1 className="text-2xl font-black">
                You have been invited to {orgName}
              </h1>
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                You have been invited as {article(invite.role)} {invite.role}, which
                means{" "}
                {ROLE_DESCRIPTION[invite.role] ?? "access to this workspace"}.
                Choose a password to create your Certly account, then you will
                be asked whether you want to join.
              </p>
              <div className="mt-6">
                <CreateAccountForm token={token} email={invite.email} />
              </div>
            </>
          ) : state === "valid" && !user ? (
            <>
              <h1 className="text-2xl font-black">
                You have been invited to {orgName}
              </h1>
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                Sign in as {invite.email} to accept. If you have forgotten your
                password, use Forgot your password on the sign in page.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                className="mt-6 block text-center bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-6 py-3 rounded-md font-bold transition"
              >
                Sign in to continue
              </Link>
            </>
          ) : state === "valid" ? (
            <>
              <h1 className="text-2xl font-black">Join {orgName}?</h1>
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                You have been invited as {article(invite.role)} {invite.role}, which
                means{" "}
                {ROLE_DESCRIPTION[invite.role] ?? "access to this workspace"}.
              </p>
              <p className="mt-3 text-sm text-[var(--brand-slate)]">
                This workspace holds employees&rsquo; identity numbers and
                copies of their identity documents. Joining means you can see
                them, and that you are handling other people&rsquo;s personal
                information.
              </p>
              <div className="mt-6">
                <InviteButtons token={token} orgName={orgName} />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black">
                {state === "wrong_account"
                  ? "Wrong account"
                  : state === "accepted"
                    ? "Already used"
                    : state === "expired"
                      ? "This invitation expired"
                      : state === "revoked"
                        ? "This invitation was withdrawn"
                        : "This link is not valid"}
              </h1>
              <p className="mt-2 text-sm text-[var(--brand-slate)]">
                {state === "wrong_account"
                  ? `This invitation was sent to ${invite?.email}. You are signed in as ${user?.email}. Sign in as the invited address to accept it.`
                  : state === "accepted"
                    ? "Somebody has already joined using this link. If that was you, sign in as normal."
                    : state === "expired"
                      ? "Invitations last fourteen days. Ask whoever invited you to send a new one."
                      : state === "revoked"
                        ? "Whoever invited you has withdrawn it."
                        : "Check that you copied the whole link, or ask for a new invitation."}
              </p>
              <Link
                href="/login"
                className="mt-6 block text-center border border-[var(--brand-line)] hover:border-[var(--brand-ink)] px-6 py-3 rounded-md font-bold text-sm transition"
              >
                Go to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
