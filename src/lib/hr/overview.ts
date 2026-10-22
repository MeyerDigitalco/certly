import type {
  CertStatus,
  CompanyDocument,
  Sector,
  TrainingPlan,
  TrainingType,
} from "@/lib/types/database";
import type { ReportEmployee } from "@/lib/reports/data";
import type { SiteSummary } from "@/lib/hr/queries";
import { EE_DESIGNATED_THRESHOLD, setaYearFor } from "@/lib/hr/operations";
import { sectorProfile } from "@/lib/sector";

/**
 * The overview is the answer to one question: if an inspector, a client or
 * the SETA asked today, what would be missing? Everything on it is a count
 * of things not yet done and a date by which they must be, because that is
 * the shape of information people act on. A percentage that only ever goes
 * up is a trophy; a count of what is missing with a deadline is a task.
 *
 * Pure. Takes what the queries fetched and computes; nothing here touches
 * the database, so every rule has a unit test.
 */

export interface OverviewInput {
  today: string;
  sector: Sector;
  seta: string | null;
  dueSoonDays: number;
  employees: ReportEmployee[];
  kpis: Record<CertStatus, number>;
  sites: SiteSummary[];
  expiredBySite: Array<{ employee_id: string; site: string | null }>;
  companyDocs: CompanyDocument[];
  trainingTypes: TrainingType[];
  trainingPlans: TrainingPlan[];
}

export type DeadlineStatus = "ready" | "behind" | "urgent" | "late" | "missing" | "voluntary";

export interface Deadline {
  key: "eea2" | "wsp" | "log";
  title: string;
  due: string;
  daysLeft: number;
  status: DeadlineStatus;
  headline: string;
  detail: string;
  href: string;
  readinessPct: number | null;
}

export interface ScoreComponent {
  key: "certificates" | "declarations" | "company_documents" | "training_details";
  label: string;
  pct: number | null;
  weight: number;
  detail: string;
  href: string;
}

export interface GateSite {
  site: string;
  people: number;
  cannotPass: number;
  canPass: number;
  readiness: number;
  expiredRecords: number;
  dueSoonRecords: number;
}

export interface Overview {
  headcount: number;
  designated: boolean;
  deadlines: Deadline[];
  score: { pct: number; components: ScoreComponent[] };
  gate: {
    sites: GateSite[];
    people: number;
    cannotPass: number;
    canPass: number;
    readiness: number;
  };
  companyDocs: { total: number; withExpiry: number; expired: number; dueSoon: number };
  pinnedReports: string[];
  guides: string[];
}

export function activeOn(e: ReportEmployee, iso: string): boolean {
  return (
    (e.engaged_at === null || e.engaged_at <= iso) &&
    (e.terminated_at === null || e.terminated_at > iso)
  );
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

/** The next occurrence of a fixed month and day on or after today. */
export function nextAnnual(today: string, month: number, day: number): string {
  const y = Number(today.slice(0, 4));
  const candidate = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return candidate >= today
    ? candidate
    : `${y + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function hasFullDeclaration(e: ReportEmployee): boolean {
  return (
    e.gender !== null &&
    e.population_group !== null &&
    e.disability !== null &&
    e.occupational_level !== null
  );
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function urgency(daysLeft: number, complete: boolean): DeadlineStatus {
  if (complete) return "ready";
  if (daysLeft <= 45) return "urgent";
  return "behind";
}

export function buildOverview(input: OverviewInput, slug: string): Overview {
  const profile = sectorProfile(input.sector);
  const inService = input.employees.filter((e) => activeOn(e, input.today));
  const headcount = inService.length;
  const designated = headcount >= EE_DESIGNATED_THRESHOLD;

  const declared = inService.filter(hasFullDeclaration).length;
  const undeclared = headcount - declared;
  const declarationPct = pct(declared, headcount);

  const eeaDue = nextAnnual(input.today, 1, 15);
  const eeaDays = daysBetween(input.today, eeaDue);
  const eea2: Deadline = {
    key: "eea2",
    title: "Employment equity report, EEA2",
    due: eeaDue,
    daysLeft: eeaDays,
    status: headcount === 0
      ? "missing"
      : !designated
        ? "voluntary"
        : urgency(eeaDays, undeclared === 0),
    headline:
      headcount === 0
        ? "Nobody on the register yet"
        : !designated
          ? `${headcount} in service, below the ${EE_DESIGNATED_THRESHOLD} that makes reporting compulsory`
          : undeclared === 0
            ? `All ${headcount} people have a complete EEA1 declaration`
            : `${undeclared} of ${headcount} people have no complete EEA1 declaration`,
    detail: designated
      ? "Compulsory for employers with 50 or more people. Online submissions close 15 January."
      : "Voluntary below 50 people. The compliance certificate is still available to you if you file.",
    href: `/${slug}/hr/reports/employment-equity`,
    readinessPct: declarationPct,
  };

  const atrTypes = input.trainingTypes.filter((t) => t.active && t.counts_for_atr);
  const atrReady = atrTypes.filter((t) => t.hours !== null && t.cost_cents !== null).length;
  const atrPct = pct(atrReady, atrTypes.length);
  const wspDue = nextAnnual(input.today, 4, 30);
  const wspDays = daysBetween(input.today, wspDue);
  const wspYear = setaYearFor(wspDue);
  const hasPlan = input.trainingPlans.some((p) => p.seta_year === wspYear);
  const seta = input.seta ?? profile.defaultSeta;
  const wspMissing: string[] = [];
  if (!seta) wspMissing.push("SETA not set");
  if (atrTypes.length - atrReady > 0) wspMissing.push(`${atrTypes.length - atrReady} training types without hours or cost`);
  if (!hasPlan) wspMissing.push("no plan for next year");
  const wsp: Deadline = {
    key: "wsp",
    title: "Workplace Skills Plan and Annual Training Report",
    due: wspDue,
    daysLeft: wspDays,
    status: !seta ? "missing" : urgency(wspDays, wspMissing.length === 0),
    headline:
      wspMissing.length === 0
        ? `Ready to submit to the ${seta}`
        : wspMissing.join(", ").replace(/^./, (c) => c.toUpperCase()),
    detail: seta
      ? `Due to the ${seta} by 30 April. Miss it and the mandatory grant, a fifth of the levy you paid, is forfeited.`
      : "Set your SETA in settings. Without it the grant cannot be claimed at all.",
    href: `/${slug}/hr/reports/skills-development`,
    readinessPct: atrPct,
  };

  const logDocs = input.companyDocs
    .filter((d) => d.category === "coida" && d.expires_at)
    .sort((a, b) => ((a.expires_at ?? "") < (b.expires_at ?? "") ? 1 : -1));
  const log = logDocs[0];
  const logDays = log?.expires_at ? daysBetween(input.today, log.expires_at) : 0;
  const logDeadline: Deadline = {
    key: "log",
    title: "Letter of good standing",
    due: log?.expires_at ?? "",
    daysLeft: logDays,
    status: !log
      ? "missing"
      : logDays < 0
        ? "late"
        : logDays <= 30
          ? "urgent"
          : "ready",
    headline: !log
      ? "No letter of good standing on file"
      : logDays < 0
        ? `Expired ${Math.abs(logDays)} days ago`
        : logDays === 0
          ? "Expires today"
          : logDays <= 30
            ? `Expires in ${logDays} days, start the renewal`
            : `Valid, ${logDays} days left`,
    detail: !log
      ? "Upload it under Documents with its expiry date. Without one on file the whole crew is turned away."
      : "Renewed each year with the Return of Earnings. An expired letter stops every person on every site.",
    href: `/${slug}/hr/documents`,
    readinessPct: null,
  };

  const withExpiry = input.companyDocs.filter((d) => d.expires_at);
  const expiredDocs = withExpiry.filter((d) => (d.expires_at ?? "") < input.today).length;
  const dueSoonDocs = withExpiry.filter((d) => {
    const dl = daysBetween(input.today, d.expires_at ?? input.today);
    return dl >= 0 && dl <= input.dueSoonDays;
  }).length;
  const companyPct = log && withExpiry.length > 0
    ? pct(withExpiry.length - expiredDocs, withExpiry.length)
    : 0;

  const certDenominator = input.kpis.valid + input.kpis.expired + input.kpis.due_soon;
  const certPct = pct(input.kpis.valid, certDenominator);

  const components: ScoreComponent[] = [
    {
      key: "certificates",
      label: "Certificates current",
      pct: certPct,
      weight: 45,
      detail:
        certDenominator === 0
          ? "No certificates with expiry dates yet"
          : `${input.kpis.expired} expired, ${input.kpis.due_soon} due within ${input.dueSoonDays} days`,
      href: `/${slug}/hr/renewals`,
    },
    {
      key: "declarations",
      label: "EEA1 declarations captured",
      pct: declarationPct,
      weight: 25,
      detail: headcount === 0 ? "Nobody on the register" : `${undeclared} of ${headcount} missing`,
      href: `/${slug}/hr/reports/employment-equity`,
    },
    {
      key: "company_documents",
      label: "Company documents current",
      pct: companyPct,
      weight: 20,
      detail: !log
        ? "No letter of good standing on file"
        : `${expiredDocs} expired, ${dueSoonDocs} due soon`,
      href: `/${slug}/hr/documents`,
    },
    {
      key: "training_details",
      label: "Training types ready for the ATR",
      pct: atrPct,
      weight: 10,
      detail:
        atrTypes.length === 0
          ? "No reportable training types"
          : `${atrTypes.length - atrReady} of ${atrTypes.length} missing hours or cost`,
      href: `/${slug}/hr/reports/skills-development/types`,
    },
  ];
  const scored = components.filter((c) => c.pct !== null);
  const weightSum = scored.reduce((a, c) => a + c.weight, 0);
  const scorePct =
    weightSum === 0
      ? 0
      : Math.round(scored.reduce((a, c) => a + (c.pct ?? 0) * c.weight, 0) / weightSum);

  const expiredPeopleBySite = new Map<string, Set<string>>();
  for (const r of input.expiredBySite) {
    const key = r.site ?? "Unassigned";
    if (!expiredPeopleBySite.has(key)) expiredPeopleBySite.set(key, new Set());
    expiredPeopleBySite.get(key)!.add(r.employee_id);
  }
  const gateSites: GateSite[] = input.sites.map((s) => {
    const cannot = expiredPeopleBySite.get(s.site)?.size ?? 0;
    return {
      site: s.site,
      people: s.people,
      cannotPass: Math.min(cannot, s.people),
      canPass: Math.max(0, s.people - cannot),
      readiness: s.readiness,
      expiredRecords: s.expired,
      dueSoonRecords: s.dueSoon,
    };
  });
  const gatePeople = gateSites.reduce((a, s) => a + s.people, 0);
  const gateCannot = gateSites.reduce((a, s) => a + s.cannotPass, 0);

  return {
    headcount,
    designated,
    deadlines: [eea2, wsp, logDeadline],
    score: { pct: scorePct, components },
    gate: {
      sites: gateSites,
      people: gatePeople,
      cannotPass: gateCannot,
      canPass: gatePeople - gateCannot,
      readiness: gatePeople === 0 ? 100 : Math.round(((gatePeople - gateCannot) / gatePeople) * 100),
    },
    companyDocs: {
      total: input.companyDocs.length,
      withExpiry: withExpiry.length,
      expired: expiredDocs,
      dueSoon: dueSoonDocs,
    },
    pinnedReports: profile.pinnedReports,
    guides: profile.guides,
  };
}
