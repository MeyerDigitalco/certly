/**
 * A suggestion, forwarded to whoever maintains Certly.
 *
 * Plain on purpose. This one is read by a developer deciding what to build
 * next, not by a customer, so it carries the facts that decide that and no
 * decoration: who, which workspace, what screen they were on, and the words
 * they actually used.
 */

export interface SuggestionInput {
  orgName: string;
  slug: string;
  fromEmail: string;
  body: string;
  context: string;
  origin: string;
}

export interface SuggestionEmail {
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

/** First line, trimmed to something that reads in an inbox list. */
export function subjectLine(orgName: string, body: string): string {
  const firstLine = body.trim().split(/\r?\n/)[0]?.trim() ?? "";
  const gist =
    firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}...` : firstLine;
  return gist ? `Certly suggestion from ${orgName}: ${gist}` : `Certly suggestion from ${orgName}`;
}

export function buildSuggestion(input: SuggestionInput): SuggestionEmail {
  const { orgName, slug, fromEmail, body, context, origin } = input;
  const where = context || "not recorded";

  const text = [
    `Workspace: ${orgName} (${slug})`,
    `From: ${fromEmail}`,
    `Screen: ${where}`,
    `Open: ${origin}/${slug}/hr`,
    "",
    "----",
    body.trim(),
  ].join("\n");

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16130E;">CERTLY</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Suggestion</span>
      </td></tr>
      <tr><td style="padding:26px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:1.6;color:#3C382F;">
          <tr><td style="padding:2px 0;color:#5C574B;width:90px;">Workspace</td><td style="padding:2px 0;">${escapeHtml(orgName)} (${escapeHtml(slug)})</td></tr>
          <tr><td style="padding:2px 0;color:#5C574B;">From</td><td style="padding:2px 0;">${escapeHtml(fromEmail)}</td></tr>
          <tr><td style="padding:2px 0;color:#5C574B;">Screen</td><td style="padding:2px 0;">${escapeHtml(where)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:18px 32px 26px;">
        <div style="border-left:3px solid #C41E1E;padding:4px 0 4px 16px;font-size:15px;line-height:1.6;color:#16130E;white-space:pre-wrap;">${escapeHtml(body.trim())}</div>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          Reply to this mail to answer them directly.<br>
          <span style="word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(`${origin}/${slug}/hr`)}</span>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject: subjectLine(orgName, body), text, html };
}
