import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Invitation tokens.
 *
 * The raw token exists in exactly one place: the link the owner shares. What
 * is stored is a SHA-256 of it, because the invitations table is readable by
 * every admin of the workspace and a stored raw token would let one admin
 * accept an invitation addressed to someone else.
 *
 * 32 random bytes, base64url, so the token is URL safe and there is nothing
 * to guess.
 */

export const INVITE_TOKEN_BYTES = 32;

export function newInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteTokensMatch(token: string, storedHash: string): boolean {
  const computed = Buffer.from(hashInviteToken(token), "hex");
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

export function inviteLink(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}

export function normaliseInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type InviteState =
  | "valid"
  | "expired"
  | "accepted"
  | "revoked"
  | "wrong_account"
  | "not_found";

export interface InviteRow {
  email: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

/**
 * Decide what to do with an invitation the moment it is opened.
 *
 * The email check is the part that matters. A token is a bearer credential:
 * anyone who gets the link holds it. Requiring the signed-in address to match
 * the invited address means a forwarded link cannot quietly hand a stranger
 * access to a register full of identity numbers.
 */
export function inviteState(
  row: InviteRow | null,
  signedInEmail: string | null,
  now: Date = new Date(),
): InviteState {
  if (!row) return "not_found";
  if (row.revoked_at) return "revoked";
  if (row.accepted_at) return "accepted";

  const expires = Date.parse(row.expires_at);
  if (Number.isNaN(expires) || expires < now.getTime()) return "expired";

  if (
    signedInEmail &&
    normaliseInviteEmail(signedInEmail) !== normaliseInviteEmail(row.email)
  ) {
    return "wrong_account";
  }

  return "valid";
}
