import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authorise a scheduled job.
 *
 * The secret is read from the Authorization header and nowhere else. It used
 * to also be accepted as a "key" query parameter, which was never needed. A
 * secret in a URL is written to the platform access log, to any proxy in
 * front of it and to browser history, and these endpoints run under the
 * service role across every workspace, so a leaked value reads the whole
 * customer base.
 *
 * An unset CRON_SECRET refuses everything rather than allowing everything, so
 * a deployment that has forgotten the variable fails closed.
 *
 * Nothing else is accepted as proof. A platform header such as x-vercel-cron
 * announces that a request is a cron call but anybody can send one, so
 * trusting it would make these endpoints public.
 */

export type CronRefusal =
  | "no_secret_configured"
  | "secret_is_blank"
  | "no_credential_presented"
  | "mismatch";

export interface CronAuthResult {
  ok: boolean;
  reason: "ok" | CronRefusal;
  /**
   * Which relevant headers arrived, by NAME only, never value. A refusal is
   * otherwise indistinguishable from the platform not sending a credential at
   * all, and those two have opposite fixes: rotate the secret, or change how
   * the job authenticates.
   */
  saw: string;
  /**
   * The configured secret's shape, never its value: "absent", "blank", or a
   * character count. A variable that exists in the dashboard but arrives
   * empty looks identical to one that was never set, and those have
   * different fixes.
   */
  secret: string;
}

export function checkCronAuth(request: Request): CronAuthResult {
  const saw = relevantHeaderNames(request);
  const raw = process.env.CRON_SECRET;

  if (raw === undefined) {
    return { ok: false, reason: "no_secret_configured", saw, secret: "absent" };
  }

  const secret = raw.trim();
  if (!secret) {
    return {
      ok: false,
      reason: "secret_is_blank",
      saw,
      secret: `blank, ${raw.length} characters of whitespace`,
    };
  }

  const shape = `${secret.length} characters`;

  const header = request.headers.get("authorization");

  // The scheme is optional and the header arrives already trimmed, so a bare
  // "Bearer" has to resolve to nothing rather than to the credential
  // "Bearer".
  const presented = (header ?? "").replace(/^Bearer\s*/i, "").trim();
  if (!presented) {
    return {
      ok: false,
      reason: "no_credential_presented",
      saw,
      secret: shape,
    };
  }

  return constantTimeEquals(presented, secret)
    ? { ok: true, reason: "ok", saw, secret: shape }
    : { ok: false, reason: "mismatch", saw, secret: shape };
}

export function authorisedCron(request: Request): boolean {
  return checkCronAuth(request).ok;
}

/**
 * Header names worth knowing about when a job will not authorise: the one we
 * read, and anything the hosting platform adds. Names only. A value here
 * would put the secret in the log this exists to avoid.
 */
function relevantHeaderNames(request: Request): string {
  const names: string[] = [];
  request.headers.forEach((_value, name) => {
    const lower = name.toLowerCase();
    if (lower === "authorization" || lower.startsWith("x-vercel-")) {
      names.push(lower);
    }
  });
  return names.sort().join(",") || "none";
}

/**
 * Compare without leaking the length through an early return. The digests are
 * fixed width whatever the inputs were, so a wrong guess of any length costs
 * the same comparison.
 */
function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
