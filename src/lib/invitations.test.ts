import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  newInviteToken,
  hashInviteToken,
  inviteTokensMatch,
  inviteLink,
  normaliseInviteEmail,
  inviteState,
  type InviteRow,
} from "./invitations";

const NOW = new Date("2026-09-08T10:00:00Z");

function row(over: Partial<InviteRow> = {}): InviteRow {
  return {
    email: "colleague@acme.co.za",
    expires_at: "2026-09-20T00:00:00Z",
    accepted_at: null,
    revoked_at: null,
    ...over,
  };
}

describe("invite tokens", () => {
  it("produces a URL safe token with no padding", () => {
    for (let i = 0; i < 20; i += 1) {
      const token = newInviteToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(42);
    }
  });

  it("never produces the same token twice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(newInviteToken());
    expect(seen.size).toBe(500);
  });

  it("stores a hash, not the token", () => {
    const token = newInviteToken();
    const hash = hashInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("matches a token to its own hash and nothing else", () => {
    const token = newInviteToken();
    const other = newInviteToken();
    expect(inviteTokensMatch(token, hashInviteToken(token))).toBe(true);
    expect(inviteTokensMatch(other, hashInviteToken(token))).toBe(false);
  });

  it("does not throw on a malformed stored hash", () => {
    const token = newInviteToken();
    expect(inviteTokensMatch(token, "")).toBe(false);
    expect(inviteTokensMatch(token, "not-hex")).toBe(false);
    expect(inviteTokensMatch(token, "ab")).toBe(false);
  });

  it("builds a link on our own origin", () => {
    expect(inviteLink("https://certly.co.za", "abc")).toBe(
      "https://certly.co.za/invite/abc",
    );
  });
});

describe("normaliseInviteEmail", () => {
  it("lowercases and trims so a capital letter is not a different person", () => {
    expect(normaliseInviteEmail("  Owner@Acme.CO.ZA ")).toBe(
      "owner@acme.co.za",
    );
  });
});

describe("inviteState", () => {
  it("accepts a live invitation opened by the invited address", () => {
    expect(inviteState(row(), "colleague@acme.co.za", NOW)).toBe("valid");
    expect(inviteState(row(), "COLLEAGUE@ACME.CO.ZA", NOW)).toBe("valid");
  });

  it("refuses a link opened by someone else, however it was obtained", () => {
    expect(inviteState(row(), "stranger@example.com", NOW)).toBe(
      "wrong_account",
    );
  });

  it("treats a not-yet-signed-in visitor as valid so they can be sent to sign in", () => {
    expect(inviteState(row(), null, NOW)).toBe("valid");
  });

  it("refuses an expired invitation", () => {
    expect(
      inviteState(row({ expires_at: "2026-09-01T00:00:00Z" }), "colleague@acme.co.za", NOW),
    ).toBe("expired");
  });

  it("refuses one that was already accepted", () => {
    expect(
      inviteState(
        row({ accepted_at: "2026-09-02T00:00:00Z" }),
        "colleague@acme.co.za",
        NOW,
      ),
    ).toBe("accepted");
  });

  it("refuses one the owner withdrew, before checking anything else", () => {
    expect(
      inviteState(
        row({ revoked_at: "2026-09-02T00:00:00Z", expires_at: "2020-01-01T00:00:00Z" }),
        "stranger@example.com",
        NOW,
      ),
    ).toBe("revoked");
  });

  it("refuses a token that matches nothing", () => {
    expect(inviteState(null, "colleague@acme.co.za", NOW)).toBe("not_found");
  });

  it("refuses an unparseable expiry rather than treating it as forever", () => {
    expect(
      inviteState(row({ expires_at: "rubbish" }), "colleague@acme.co.za", NOW),
    ).toBe("expired");
  });
});
