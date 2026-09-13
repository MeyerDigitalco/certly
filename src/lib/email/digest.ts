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
  const who = `${row.surname}, ${row.names}`;
  const when =
    row.days_left < 0
      ? `${Math.abs(row.days_left)} days over`
      : row.days_left === 0
        ? "today"
        : `${row.days_left} days`;
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

  const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#161616;max-width:600px">
  <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;color:#B91C1C;margin:0 0 4px">Certly</p>
  <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(orgName)} compliance summary</h1>
  ${section("Lapsed", "These people cannot pass a gate check today.", expired, "#B91C1C")}
  ${section("Due within seven days", "", soon, "#92400E")}
  <p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="color:#B91C1C;font-weight:700">See the full list</a></p>
  <p style="font-size:12px;color:#4B5563;margin-top:24px;border-top:1px solid #E5E0D8;padding-top:12px">
    You are getting this because you are an admin on this Certly workspace. Turn it off in Settings.
  </p>
</div>`.trim();

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
        `<li style="margin-bottom:4px">${escapeHtml(line(row))}</li>`,
    )
    .join("");
  const more =
    rows.length > 40
      ? `<li style="color:#4B5563">and ${rows.length - 40} more</li>`
      : "";
  return `
  <h2 style="font-size:14px;color:${colour};margin:20px 0 4px">${escapeHtml(title)} (${rows.length})</h2>
  ${note ? `<p style="font-size:13px;color:#4B5563;margin:0 0 8px">${escapeHtml(note)}</p>` : ""}
  <ul style="font-size:13px;padding-left:18px;margin:0">${items}${more}</ul>`;
}
