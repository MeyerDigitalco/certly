import { describe, it, expect } from "vitest";
import { buildDigest, digestIsWorthSending } from "./digest";
import type { RenewalBuckets, RenewalRow } from "@/lib/hr/queries";

function row(over: Partial<RenewalRow> = {}): RenewalRow {
  return {
    key: "cert:1",
    kind: "certification",
    employee_id: "e1",
    surname: "Dlamini",
    names: "Sipho",
    id_number: "8001015009087",
    site: "Impala 14 Shaft",
    superior: "T. Mokoena",
    label: "Working at heights",
    expiry_date: "2026-09-01",
    days_left: -7,
    certification_id: "c1",
    document_id: null,
    ...over,
  };
}

function buckets(over: Partial<RenewalBuckets> = {}): RenewalBuckets {
  return {
    expired: [],
    dueSeven: [],
    dueThirty: [],
    horizonDays: 30,
    ...over,
  };
}

const BASE = {
  orgName: "Acme Scaffolding",
  slug: "acme",
  origin: "https://certly.co.za",
};

describe("digestIsWorthSending", () => {
  it("does not send an empty digest, which only teaches people to filter us", () => {
    expect(digestIsWorthSending(buckets())).toBe(false);
    expect(
      digestIsWorthSending(buckets({ dueThirty: [row({ days_left: 20 })] })),
    ).toBe(false);
  });

  it("sends when something has lapsed or is due this week", () => {
    expect(digestIsWorthSending(buckets({ expired: [row()] }))).toBe(true);
    expect(
      digestIsWorthSending(buckets({ dueSeven: [row({ days_left: 3 })] })),
    ).toBe(true);
  });
});

describe("buildDigest", () => {
  const digest = buildDigest({
    ...BASE,
    buckets: buckets({
      expired: [row(), row({ key: "cert:2", surname: "Banda", days_left: -1 })],
      dueSeven: [row({ key: "cert:3", surname: "Ncube", days_left: 3 })],
    }),
  });

  it("puts the counts in the subject so it reads in a notification", () => {
    expect(digest.subject).toBe("Acme Scaffolding: 2 lapsed, 1 due this week");
  });

  it("drops the lapsed count from the subject when nothing has lapsed", () => {
    const soonOnly = buildDigest({
      ...BASE,
      buckets: buckets({ dueSeven: [row({ days_left: 2 })] }),
    });
    expect(soonOnly.subject).toBe("Acme Scaffolding: 1 due this week");
  });

  it("stands on its own as plain text", () => {
    expect(digest.text).toContain("Dlamini, Sipho");
    expect(digest.text).toContain("Impala 14 Shaft");
    expect(digest.text).toContain("Working at heights");
    expect(digest.text).toContain("7 days over");
    expect(digest.text).toContain("https://certly.co.za/acme/hr/renewals");
    expect(digest.text).not.toContain("<");
  });

  it("says how to stop receiving it", () => {
    expect(digest.text.toLowerCase()).toContain("turn it off");
    expect(digest.html.toLowerCase()).toContain("turn it off");
  });

  it("reads today as today rather than as zero days", () => {
    const sameDay = buildDigest({
      ...BASE,
      buckets: buckets({ dueSeven: [row({ days_left: 0 })] }),
    });
    expect(sameDay.text).toContain("today");
    expect(sameDay.text).not.toContain("0 days");
  });

  it("escapes names so a stray angle bracket cannot break the markup", () => {
    const nasty = buildDigest({
      ...BASE,
      orgName: 'Acme <script>alert("x")</script>',
      buckets: buckets({ expired: [row({ surname: "O<br>Brien" })] }),
    });
    expect(nasty.html).not.toContain("<script>");
    expect(nasty.html).toContain("&lt;script&gt;");
    expect(nasty.html).toContain("O&lt;br&gt;Brien");
  });

  it("truncates a very long list instead of sending a thousand lines", () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      row({ key: `cert:${i}`, surname: `Person${i}` }),
    );
    const big = buildDigest({ ...BASE, buckets: buckets({ expired: many }) });
    expect(big.text).toContain("and 80 more");
    expect(big.html).toContain("and 80 more");
    expect(big.text.split("\n").length).toBeLessThan(60);
  });

  it("omits a section that has nothing in it", () => {
    const expiredOnly = buildDigest({
      ...BASE,
      buckets: buckets({ expired: [row()] }),
    });
    expect(expiredOnly.text).not.toContain("DUE WITHIN SEVEN DAYS");
    expect(expiredOnly.html).not.toContain("Due within seven days");
  });
});

describe("counting days in the digest", () => {
  const row = (days: number) =>
    ({
      kind: "certification",
      surname: "Mogopa",
      names: "Mopako Frans",
      label: "HIRA",
      days_left: days,
      site: "",
    }) as never;

  function textFor(days: number, expired: boolean): string {
    return buildDigest({
      orgName: "MDC",
      slug: "mdc",
      origin: "https://certly.co.za",
      buckets: {
        expired: expired ? [row(days)] : [],
        dueSeven: expired ? [] : [row(days)],
        dueThirty: [],
        horizonDays: 30,
      },
    }).text;
  }

  it("says day, not days, when there is one of them", () => {
    expect(textFor(-1, true)).toContain("1 day over");
    expect(textFor(1, false)).toContain("- 1 day");
  });

  it("still says days for anything else", () => {
    expect(textFor(-4, true)).toContain("4 days over");
    expect(textFor(6, false)).toContain("6 days");
  });

  it("says today rather than 0 days", () => {
    expect(textFor(0, false)).toContain("today");
  });

  it("builds an absolute link, because a relative one is dead in an inbox", () => {
    const html = buildDigest({
      orgName: "MDC",
      slug: "mdc",
      origin: "https://certly.co.za",
      buckets: { expired: [], dueSeven: [row(3)], dueThirty: [], horizonDays: 30 },
    }).html;
    expect(html).toContain("https://certly.co.za/mdc/hr/renewals");
    expect(html).not.toContain('href="/mdc');
  });
});
