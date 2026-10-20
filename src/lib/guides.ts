/**
 * The guide library.
 *
 * One entry per page under /guides. The registry is the single source for
 * the index page, the sitemap, the cross-links at the foot of each guide and
 * the structured data, so a new guide becomes discoverable everywhere by
 * being added here once.
 *
 * These pages exist to be found by someone searching for a deadline they are
 * worried about, not to describe Certly. Each one answers the question first
 * and mentions the product once, at the end.
 */

export interface Guide {
  slug: string;
  title: string;
  /** The page h1, which can differ from the browser title. */
  heading: string;
  /** Meta description, 150 to 160 characters. */
  description: string;
  /** One line on the index card. */
  blurb: string;
  /** ISO date this guide's facts were last checked. */
  updated: string;
  /** Shown under the heading as the thing the reader is worried about. */
  deadline?: string;
  keywords: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "employment-equity-report",
    title: "Employment equity report (EEA2): who must submit and when",
    heading: "The employment equity report, explained",
    description:
      "Who has to submit an EEA2 in South Africa, the 15 January deadline, what goes on the form, and what the compliance certificate means for state contracts.",
    blurb:
      "Fifty or more employees makes you a designated employer. Here is what that costs you in paperwork and what it buys you in tenders.",
    updated: "2026-10-20",
    deadline: "Online submissions close 15 January",
    keywords: [
      "EEA2",
      "employment equity report",
      "designated employer",
      "employment equity deadline",
      "EE compliance certificate",
    ],
  },
  {
    slug: "workplace-skills-plan",
    title: "WSP and ATR: the 30 April deadline and the mandatory grant",
    heading: "The Workplace Skills Plan and Annual Training Report",
    description:
      "What the WSP and ATR are, which SETA you submit to, the 30 April deadline, and how much of your skills levy you forfeit by missing it.",
    blurb:
      "You already paid the skills levy. Twenty percent of it comes back only if the report is in by 30 April.",
    updated: "2026-10-20",
    deadline: "Submissions close 30 April",
    keywords: [
      "workplace skills plan",
      "annual training report",
      "WSP ATR deadline",
      "mandatory grant",
      "SETA submission",
      "MQA",
      "CETA",
    ],
  },
  {
    slug: "letter-of-good-standing",
    title: "COIDA letter of good standing: how it lapses and how to renew",
    heading: "The letter of good standing",
    description:
      "What a COIDA letter of good standing is, why it expires every year with the Return of Earnings cycle, and what happens on site when it does.",
    blurb:
      "Free to issue, annual to renew, and the single document most likely to turn your whole crew away at a gate.",
    updated: "2026-10-20",
    deadline: "Tied to the Return of Earnings cycle",
    keywords: [
      "letter of good standing",
      "COIDA",
      "compensation fund",
      "return of earnings",
      "COID letter expired",
    ],
  },
  {
    slug: "contractor-safety-file",
    title: "What goes into a contractor safety file in South Africa",
    heading: "The contractor safety file",
    description:
      "What a client expects in a contractor health and safety file, which parts go stale fastest, and how to rebuild it without starting from a blank page.",
    blurb:
      "Every client wants the pack their own way, and the employee half of it is out of date the week after you submit.",
    updated: "2026-10-20",
    keywords: [
      "safety file",
      "contractor safety file",
      "health and safety file",
      "construction regulations",
      "site access pack",
    ],
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** The other guides, for the cross-links at the foot of a page. */
export function otherGuides(slug: string, limit = 3): Guide[] {
  return GUIDES.filter((g) => g.slug !== slug).slice(0, limit);
}

export function guidePath(slug: string): string {
  return `/guides/${slug}`;
}

/** 20 October 2026, the form a South African reader expects. */
export function longDate(iso: string): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}
