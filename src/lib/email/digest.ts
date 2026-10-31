import type { RenewalBuckets, RenewalRow } from "@/lib/hr/queries";

/**
 * The weekly expiry digest.
 *
 * Written as plain text first and marked up second, because a supervisor
 * reads this on a phone at a gate, often on a bad connection, and the plain
 * part has to stand on its own. No images, no tracking pixel, no button that
 * is the only way to act.
 *
 * A digest with nothing in it is not sent at all. An empty weekly email
 * teaches people to filter the sender, and then the one that matters is not
 * read either.
 */

export interface DigestInput {
  orgName: string;
  slug: string;
  origin: string;
  buckets: RenewalBuckets;
}

export interface Digest {
  subject: string;
  text: string;
  html: string;
}

export function digestIsWorthSending(buckets: RenewalBuckets): boolean {
  return buckets.expired.length + buckets.dueSeven.length > 0;
}

function line(row: RenewalRow): string {
  const who =
    row.kind === "company_document" ? `Company document (${row.names})` : `${row.surname}, ${row.names}`;
  const over = Math.abs(row.days_left);
  const when =
    row.days_left < 0
      ? `${over} ${over === 1 ? "day" : "days"} over`
      : row.days_left === 0
        ? "today"
        : `${row.days_left} ${row.days_left === 1 ? "day" : "days"}`;
  const where = row.site ? ` (${row.site})` : "";
  return `${who}${where} - ${row.label} - ${when}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildDigest(input: DigestInput): Digest {
  const { orgName, slug, origin, buckets } = input;
  const expired = buckets.expired;
  const soon = buckets.dueSeven;
  const link = `${origin}/${slug}/hr/renewals`;

  const headline =
    expired.length > 0
      ? `${expired.length} ${expired.length === 1 ? "person is" : "people are"} off the gate`
      : `${soon.length} ${soon.length === 1 ? "certificate expires" : "certificates expire"} this week`;

  const standfirst =
    expired.length > 0
      ? `${orgName}. Renew these before the next shift, and check the ones due this week while you are in there.`
      : `${orgName}. Nothing has lapsed yet. Renew these and it stays that way.`;

  const subject =
    expired.length > 0
      ? `${orgName}: ${expired.length} lapsed, ${soon.length} due this week`
      : `${orgName}: ${soon.length} due this week`;

  const textParts: string[] = [];
  textParts.push(`${orgName} compliance summary`);
  textParts.push("");

  if (expired.length > 0) {
    textParts.push(
      `LAPSED (${expired.length}) - these people cannot pass a gate check today`,
    );
    for (const row of expired.slice(0, 40)) textParts.push(`  ${line(row)}`);
    if (expired.length > 40) {
      textParts.push(`  and ${expired.length - 40} more`);
    }
    textParts.push("");
  }

  if (soon.length > 0) {
    textParts.push(`DUE WITHIN SEVEN DAYS (${soon.length})`);
    for (const row of soon.slice(0, 40)) textParts.push(`  ${line(row)}`);
    if (soon.length > 40) textParts.push(`  and ${soon.length - 40} more`);
    textParts.push("");
  }

  textParts.push(`Full list: ${link}`);
  textParts.push("");
  textParts.push(
    "You are getting this because you are an admin on this Certly workspace. Turn it off in Settings.",
  );

  // Laid out in tables on a cream page, matching the signup and reset mails,
  // because an email client is not a browser: no flexbox, no stylesheet, and
  // every colour has to be inline or a dark mode will invert it into mud.
  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EDE7D9;padding:32px 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFDF7;border:1px solid #16130E;">
      <tr><td style="padding:26px 32px 18px;border-bottom:3px solid #C41E1E;">
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16130E;">CERTLY</span>
        <span style="float:right;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5C574B;padding-top:10px;">Weekly summary</span>
      </td></tr>
      <tr><td style="padding:30px 32px 6px;">
        <h1 style="margin:0;font-size:22px;line-height:1.25;color:#16130E;">${escapeHtml(headline)}</h1>
        <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#3C382F;">${escapeHtml(standfirst)}</p>
      </td></tr>
      <tr><td style="padding:14px 32px 0;">
        ${section("Lapsed", "These people cannot pass a gate check today.", expired, "#C41E1E")}
        ${section("Due within seven days", "", soon, "#8A5A00")}
      </td></tr>
      <tr><td style="padding:22px 32px 30px;">
        <a href="${escapeHtml(link)}"
           style="display:inline-block;background:#C41E1E;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;">
          Open the renewals list
        </a>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;border-top:1px solid #C9C0A9;background:#F7F3E9;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          Button not working? Copy this into your browser:<br>
          <span style="word-break:break-all;font-family:'Courier New',monospace;">${escapeHtml(link)}</span>
        </p>
      </td></tr>
      <tr><td style="padding:14px 32px 22px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#5C574B;">
          You are getting this because you are an admin on ${escapeHtml(orgName)}. Turn it off in Settings.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject, text: textParts.join("\n"), html };
}

function section(
  title: string,
  note: string,
  rows: RenewalRow[],
  colour: string,
): string {
  if (rows.length === 0) return "";
  const items = rows
    .slice(0, 40)
    .map(
      (row) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid #EDE7D9;font-size:14px;line-height:1.4;color:#16130E;">${escapeHtml(line(row))}</td></tr>`,
    )
    .join("");
  const more =
    rows.length > 40
      ? `<tr><td style="padding:7px 0;font-size:13px;color:#5C574B;">and ${rows.length - 40} more</td></tr>`
      : "";
  return `
        <p style="margin:18px 0 2px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;color:${colour};">${escapeHtml(title)} (${rows.length})</p>
        ${note ? `<p style="margin:0 0 6px;font-size:13px;color:#5C574B;">${escapeHtml(note)}</p>` : ""}
        <table width="100%" cellpadding="0" cellspacing="0" border="0">${items}${more}</table>`;
}
