/**
 * Security notices.
 *
 * A password change is the one event where silence is the dangerous option.
 * If somebody else sets a password on an account, the person who owns it
 * finds out when they next fail to sign in, which may be days later, and by
 * then a stranger has been reading a register of other people's identity
 * numbers. One short mail closes that window.
 *
 * Deliberately plain and deliberately without a one-click undo. A link that
 * reverses a password change is itself a thing worth phishing, so this points
 * at the normal reset flow instead.
 */

export interface PasswordChangedInput {
  email: string;
  origin: string;
  when: Date;
}

export interface SecurityEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** South African reading order, and the zone named so it is never guessed. */
export function formatMoment(when: Date): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(when);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} at ${get("hour")}:${get("minute")} SAST`;
}

export function buildPasswordChanged(
  input: PasswordChangedInput,
): SecurityEmail {
  const { email, origin, when } = input;
  const moment = formatMoment(when);
  const resetLink = `${origin}/forgot-password`;

  const subject = "Your Certly password was changed";

  const text = [
    `The password on your Certly account (${email}) was changed on ${moment}.`,
    "",
    "If that was you, there is nothing to do.",
    "",
    "If it was not, somebody else has access to this account. Reset the password now and tell whoever owns the workspace:",
    resetLink,
  ].join("\n");

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16130E;">CERTLY</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Security</span>
      </td></tr>
      <tr><td style="padding:30px 32px 6px;">
        <h1 style="margin:0;font-size:22px;line-height:1.25;color:#16130E;">Your password was changed</h1>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#3C382F;">
          The password on your Certly account (${escapeHtml(email)}) was changed on ${escapeHtml(moment)}.
        </p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#3C382F;">
          If that was you, there is nothing to do.
        </p>
      </td></tr>
      <tr><td style="padding:18px 32px 6px;">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#3C382F;">
          If it was not, somebody else has access to this account. Reset the password now and tell whoever owns the workspace.
        </p>
        <a href="${escapeHtml(resetLink)}"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Reset my password
        </a>
      </td></tr>
      <tr><td style="padding:20px 32px 22px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          Button not working? Copy this into your browser:<br>
          <span style="word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(resetLink)}</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject, text, html };
}
