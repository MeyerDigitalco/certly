/**
 * Who may see the operator console.
 *
 * Held in an environment variable rather than in code, so adding or removing
 * a person is a dashboard change rather than a deploy, and so a fork of this
 * repository grants nobody anything.
 *
 * It fails closed. A blank or missing variable means no one qualifies, which
 * is the only safe reading: the alternative is a deploy with an unset
 * variable handing every signed-in user a cross workspace view.
 *
 * Kept free of server imports so the rule itself can be tested on its own.
 */

export function superadminEmails(): string[] {
  return (process.env.CERTLY_SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperadmin(email: string | null | undefined): boolean {
  const allowed = superadminEmails();
  if (allowed.length === 0) return false;
  const candidate = (email ?? "").trim().toLowerCase();
  if (!candidate) return false;
  return allowed.includes(candidate);
}
