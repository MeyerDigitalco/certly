"use client";

import { useMemo, useState } from "react";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const DUE_SOON_DAYS = 30;

const CREW = [
  { name: "MOKOENA S.", role: "Rigger", cert: "ONSIDE INDUCTION", days: -6 },
  { name: "NDLOVU T.", role: "Fitter", cert: "MEDICAL", days: 12 },
  { name: "VAN WYK J.", role: "Team Leader", cert: "WORKING AT HEIGHTS", days: 34 },
  { name: "MAHLANGU P.", role: "Boilermaker", cert: "CONFINED SPACE", days: 58 },
  { name: "BOTHA A.", role: "Safety Officer", cert: "MINES LEGAL LIAB.", days: 91 },
  { name: "SITHOLE K.", role: "Welder", cert: "GAS/ARC WELDING", days: 140 },
  { name: "NAIDOO R.", role: "Electrician", cert: "POWER TOOLS", days: 203 },
  { name: "KHUMALO M.", role: "Fire Technician", cert: "SAQCC", days: 260 },
  { name: "PRETORIUS D.", role: "Operator", cert: "CONVEYOR BELT SAF.", days: 330 },
];

function addDays(base: Date, n: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function GateBoard() {
  const [offset, setOffset] = useState(0);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const rows = CREW.map((p) => {
    const left = p.days - offset;
    const status = left < 0 ? "expired" : left <= DUE_SOON_DAYS ? "due" : "valid";
    return { ...p, left, status, expiry: addDays(today, p.days) };
  });

  const cleared = rows.filter((r) => r.status !== "expired").length;
  const when = addDays(today, offset);

  return (
    <div className="printout">
      <div className="po-head">
        <div>
          <div className="po-t">Gate check &middot; example crew</div>
          <div className="po-s">Shaft 4 &middot; Rustenburg</div>
        </div>
        <div className="po-count">
          <span
            className="n"
            style={{
              color: cleared === rows.length ? "var(--green)" : "var(--red)",
            }}
          >
            {cleared}/{rows.length}
          </span>
          <span className="l">Cleared for site</span>
        </div>
      </div>

      <div className="po-scrub">
        <div className="po-scrub-row">
          <span>Register as at</span>
          <b>{offset === 0 ? `TODAY ${formatDate(when)}` : formatDate(when)}</b>
        </div>
        <input
          type="range"
          min={0}
          max={365}
          step={1}
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
          aria-label="Days from today"
        />
        <div className="po-scale">
          <span>Today</span>
          <span>+6 months</span>
          <span>+12 months</span>
        </div>
      </div>

      <div className="po-rows">
        {rows.map((r) => (
          <div key={r.name} className="po-row">
            <div>
              <div className="po-nm">{r.name}</div>
              <div className="po-mt">
                {r.role.toUpperCase()} &nbsp;{r.cert} &nbsp;EXP {formatDate(r.expiry)}
              </div>
            </div>
            <span
              className={
                r.status === "expired"
                  ? "code c-red"
                  : r.status === "due"
                    ? "code c-amb"
                    : "code c-grn"
              }
            >
              {r.status === "expired"
                ? `[ EXPIRED ${String(Math.abs(r.left)).padStart(3, "0")}d ]`
                : r.status === "due"
                  ? `[ DUE ${String(r.left).padStart(3, "0")}d ]`
                  : `[ VALID ${String(r.left).padStart(3, "0")}d ]`}
            </span>
          </div>
        ))}
      </div>

      <div className="po-foot">
        Example data &middot; your register uses your own people and your own
        due-soon window
      </div>
    </div>
  );
}

const CLIENTS = [
  { key: "Impala Platinum", short: "Impala" },
  { key: "Sibanye-Stillwater", short: "Sibanye" },
  { key: "Anglo American", short: "Anglo" },
  { key: "Generic OHS Act", short: "Generic" },
];

const PACK_SECTIONS = [
  { num: "01", label: "Health, safety and environmental policy", tag: "s" },
  { num: "05", label: "Proof of company registration", tag: "s" },
  { num: "07", label: "Public liability cover", tag: "s" },
  { num: "09", label: "Site team organogram", tag: "a" },
  { num: "11", label: "List of employees on this project", tag: "a" },
  { num: "16", label: "Statutory legal appointments", tag: "y" },
  { num: "21", label: "Hazard identification and risk assessment", tag: "y" },
  { num: "24", label: "Certificates of competency", tag: "a" },
  { num: "25", label: "Medical certificates of fitness", tag: "a" },
  { num: "28", label: "Awareness and induction training records", tag: "a" },
];

const TAG_LABEL: Record<string, string> = {
  a: "Drafted",
  s: "Stored",
  y: "Sign off",
};

export function SafetyFilePack() {
  const [client, setClient] = useState(CLIENTS[0].key);

  return (
    <div className="pack-wrap">
      <div className="clients" role="group" aria-label="Choose client pack">
        {CLIENTS.map((c) => (
          <button
            key={c.key}
            type="button"
            className="cbtn"
            aria-pressed={c.key === client}
            onClick={() => setClient(c.key)}
          >
            {c.short}
          </button>
        ))}
      </div>

      <div className="pack">
        <div className="pack-h">
          <span className="nm">{client} &middot; contractor pack</span>
          <span className="pg">18 / 29 ready</span>
        </div>
        <ul>
          {PACK_SECTIONS.map((s) => (
            <li key={s.num}>
              <span className="pn">{s.num}</span>
              <span>{s.label}</span>
              <span className={`tg tg-${s.tag}`}>{TAG_LABEL[s.tag]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface ReportBar {
  label: string;
  a: number;
  b: number;
}

interface ReportDemo {
  key: string;
  short: string;
  title: string;
  stamp: string;
  blurb: string;
  seriesA: string;
  seriesB: string;
  bars: ReportBar[];
  lines: Array<{ left: string; right: string; tone?: "red" | "amber" | "green" }>;
}

const REPORT_DEMOS: ReportDemo[] = [
  {
    key: "movement",
    short: "Staff movement",
    title: "Staff movement",
    stamp: "AUG 2026 · 3 SITES",
    blurb:
      "Who left and why, split by site and by fault or no fault, against who joined and what the approved plan says each site should carry.",
    seriesA: "Approved plan",
    seriesB: "In service",
    bars: [
      { label: "SHAFT 1", a: 48, b: 44 },
      { label: "SHAFT 2", a: 31, b: 31 },
      { label: "PLANT", a: 22, b: 17 },
    ],
    lines: [
      { left: "Headcount at month end", right: "92" },
      { left: "Joiners", right: "6", tone: "green" },
      { left: "Leavers", right: "9", tone: "red" },
      { left: "Turnover", right: "9.7%", tone: "amber" },
    ],
  },
  {
    key: "fault",
    short: "Fault terminations",
    title: "Fault terminations, year on year",
    stamp: "YTD TO AUG 2026",
    blurb:
      "Resignations, dismissals and abscondments by month, this year against last. The chart a client uses to ask why March was bad.",
    seriesA: "2025",
    seriesB: "2026",
    bars: [
      { label: "FEB", a: 3, b: 2 },
      { label: "MAR", a: 4, b: 9 },
      { label: "APR", a: 2, b: 5 },
      { label: "MAY", a: 5, b: 3 },
    ],
    lines: [
      { left: "Resignations, year to date", right: "21" },
      { left: "Dismissals, year to date", right: "7" },
      { left: "Abscondments, year to date", right: "4" },
      { left: "Change on same months last year", right: "+38%", tone: "red" },
    ],
  },
  {
    key: "retirement",
    short: "Overdue retirement",
    title: "Overdue retirement",
    stamp: "AS AT 31 AUG 2026",
    blurb:
      "Everyone past their contractual retirement date, on an approved extension, retiring this month, or due inside six months.",
    seriesA: "Overdue",
    seriesB: "Due in 6 months",
    bars: [
      { label: "SHAFT 1", a: 3, b: 4 },
      { label: "SHAFT 2", a: 1, b: 2 },
      { label: "PLANT", a: 2, b: 1 },
    ],
    lines: [
      { left: "Past retirement date", right: "6", tone: "red" },
      { left: "On approved extension", right: "4", tone: "amber" },
      { left: "Retiring this month", right: "2" },
      { left: "No date of birth on file", right: "3", tone: "amber" },
    ],
  },
  {
    key: "plan",
    short: "Labour plan",
    title: "Labour plan and onboarding",
    stamp: "AUG 2026 · TOP 3 ROLES",
    blurb:
      "Approved positions against people in service by designation, and the screening, medical, TEBA and training pipeline behind every gap.",
    seriesA: "Planned",
    seriesB: "In service",
    bars: [
      { label: "MINER", a: 24, b: 22 },
      { label: "FITTER", a: 12, b: 12 },
      { label: "RIGGER", a: 9, b: 6 },
    ],
    lines: [
      { left: "Approved positions", right: "101" },
      { left: "In service", right: "92" },
      { left: "In the pipeline", right: "5", tone: "amber" },
      { left: "Still unfilled", right: "4", tone: "red" },
    ],
  },
];

export function ReportBoard() {
  const [key, setKey] = useState(REPORT_DEMOS[0].key);
  const demo = REPORT_DEMOS.find((d) => d.key === key) ?? REPORT_DEMOS[0];
  const max = Math.max(1, ...demo.bars.flatMap((b) => [b.a, b.b]));

  return (
    <div className="pack-wrap">
      <div className="clients" role="group" aria-label="Choose a monthly report">
        {REPORT_DEMOS.map((d) => (
          <button
            key={d.key}
            type="button"
            className="cbtn"
            aria-pressed={d.key === key}
            onClick={() => setKey(d.key)}
          >
            {d.short}
          </button>
        ))}
      </div>

      <div className="pack">
        <div className="pack-h">
          <span className="nm">{demo.title}</span>
          <span className="pg">{demo.stamp}</span>
        </div>

        <div className="rep-b">
          <p className="rep-blurb">{demo.blurb}</p>

          <div className="rep-chart" role="img" aria-label={`${demo.seriesA} against ${demo.seriesB}`}>
            {demo.bars.map((b) => (
              <div className="rep-grp" key={b.label}>
                <div className="rep-cols">
                  <span className="rep-bar rep-a" style={{ height: `${(b.a / max) * 100}%` }}>
                    <i>{b.a}</i>
                  </span>
                  <span className="rep-bar rep-b2" style={{ height: `${(b.b / max) * 100}%` }}>
                    <i>{b.b}</i>
                  </span>
                </div>
                <span className="rep-cat">{b.label}</span>
              </div>
            ))}
          </div>

          <div className="rep-key">
            <span>
              <span className="rep-sw rep-a" />
              {demo.seriesA}
            </span>
            <span>
              <span className="rep-sw rep-b2" />
              {demo.seriesB}
            </span>
          </div>

          <ul className="rep-lines">
            {demo.lines.map((l) => (
              <li key={l.left}>
                <span>{l.left}</span>
                <span
                  className={
                    l.tone === "red"
                      ? "code c-red"
                      : l.tone === "amber"
                        ? "code c-amb"
                        : l.tone === "green"
                          ? "code c-grn"
                          : "code"
                  }
                >
                  {l.right}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="po-foot">
          Download as Excel &nbsp;&middot;&nbsp; print to PDF &nbsp;&middot;&nbsp; built from
          your register, not retyped
        </div>
      </div>
    </div>
  );
}

export function PriceCalculator() {
  const [people, setPeople] = useState(50);
  const extra = Math.max(0, people - 50);
  const total = 999 + extra * 10;
  const money = (n: number) => `R${n.toLocaleString("en-ZA")}`;

  return (
    <div className="calc">
      <div className="calc-h">Estimate &middot; monthly subscription</div>
      <div className="calc-b">
        <div className="calc-top">
          <div className="fld">
            People on register<b>{people}</b>
          </div>
          <div>
            <div className="amt">{money(total)}</div>
            <div className="per">
              works out to R{(total / people).toFixed(2)} a head
            </div>
          </div>
        </div>

        <div className="calc-s">
          <input
            type="range"
            min={5}
            max={500}
            step={5}
            value={people}
            onChange={(e) => setPeople(Number(e.target.value))}
            aria-label="People on your register"
          />
          <div className="calc-scale">
            <span>5</span>
            <span>250</span>
            <span>500</span>
          </div>
        </div>

        <div className="ledger">
          <div>
            <span>Base, to 50 people</span>
            <span>R999</span>
          </div>
          <div>
            <span>{extra === 0 ? "Additional people" : `${extra} extra at R10`}</span>
            <span>{money(extra * 10)}</span>
          </div>
          <div className="tot">
            <span>Monthly total</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <div className="vat">
          Per working day: R{Math.round(total / 30)} &nbsp;&middot;&nbsp; Rand.
          No VAT is charged.
        </div>
      </div>
    </div>
  );
}
