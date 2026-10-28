import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authorise a scheduled job.
 *
 * The secret is read from the Authorization header and nowhere else. It used
 * to also be accepted as a "key" query parameter, which was never needed,
 * because Vercel sends CRON_SECRET as a bearer token. A secret in a URL is
 * written to the platform access log, to any proxy in front of it and to
 * browser history, and these two endpoints run under the service role across
 * every workspace, so a leaked value reads the whole customer base.
 *
 * An unset CRON_SECRET refuses everything rather than allowing everything,
 * so a deployment that has forgotten the variable fails closed.
 */
export function authorisedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const presented =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  return constantTimeEquals(presented, secret);
}

/**
 * Compare without leaking the length through an early return. The digests are
 * fixed width whatever the inputs were, so a wrong guess of any length costs
 * the same comparison.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = sha256(a);
  const right = sha256(b);
  return timingSafeEqual(left, right);
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}
