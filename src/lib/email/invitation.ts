/**
 * The invitation email.
 *
 * Until now an invitation produced a link and nothing else, and the owner had
 * to carry it to the person by hand. That is fine for the first colleague and
 * wrong for the fifth, and a link pasted into a chat app is also the one copy
 * of a bearer credential sitting in somebody's message history.
 *
 * The link still appears on screen, because this email can be skipped,
 * delayed or filtered and the owner must never be left with no way to invite
 * anyone. Same layout as the weekly digest and the auth mails: tables, inline
 * colour, no images.
 */

export interface InvitationInput {
  orgName: string;
  invitedBy: string;
  role: string;
  email: string;
  link: string;
  days: number;
}

export interface InvitationEmail {
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

/** What the role lets them do, in the words a site manager would use. */
export function describeRole(role: string): string {
  switch (role) {
    case "owner":
      return "You will be an owner, so you can do everything, including billing.";
    case "viewer":
      return "You will be a viewer, so you can see who is compliant and what is expiring, but you cannot change records or open the statutory reports.";
    default:
      return "You will be an admin, so you can add people, load certificates and pull the statutory reports.";
  }
}

export function buildInvitation(input: InvitationInput): InvitationEmail {
  const { orgName, invitedBy, role, link, days } = input;
  const window = `${days} ${days === 1 ? "day" : "days"}`;
  const roleNote = describeRole(role);

  const subject = `${invitedBy} has invited you to ${orgName} on Certly`;

  const text = [
    `${invitedBy} has invited you to the ${orgName} workspace on Certly.`,
    "",
    "Certly is where this company keeps its people's tickets and certificates, and tracks what is about to expire.",
    "",
    roleNote,
    "",
    "Accept the invitation here:",
    link,
    "",
    `You will be asked to sign in as ${input.email}, because an invitation is tied to one address. The link stops working in ${window}.`,
    "",
    "If you were not expecting this, ignore it. Nothing happens until you accept.",
  ].join("\n");

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16130E;">CERTLY</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Invitation</span>
      </td></tr>
      <tr><td style="padding:30px 32px 6px;">
        <h1 style="margin:0;font-size:22px;line-height:1.25;color:#16130E;">You have been invited to ${escapeHtml(orgName)}</h1>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#3C382F;">
          ${escapeHtml(invitedBy)} has added you to the ${escapeHtml(orgName)} workspace on Certly, where the company keeps its people's tickets and certificates and tracks what is about to expire.
        </p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#3C382F;">${escapeHtml(roleNote)}</p>
      </td></tr>
      <tr><td style="padding:22px 32px 8px;">
        <a href="${escapeHtml(link)}"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Accept the invitation
        </a>
      </td></tr>
      <tr><td style="padding:6px 32px 26px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#5C574B;">
          You will be asked to sign in as ${escapeHtml(input.email)}, because an invitation is tied to one address. The link stops working in ${escapeHtml(window)}.
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          Button not working? Copy this into your browser:<br>
          <span style="word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(link)}</span>
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          If you were not expecting this, ignore it. Nothing happens until you accept.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject, text, html };
}
