import { Download } from "lucide-react";
import { requireTenant } from "@/lib/tenant";
import { getSafetyFileData } from "@/lib/hr/queries";
import { idTypeLabel, countryLabel } from "@/lib/validation/identification";
import { isAdmin } from "@/lib/auth/roles";
import { todayIso } from "@/lib/certifications/status";
import PrintButton from "./PrintButton";

export const metadata = { title: "Safety file" };
export const dynamic = "force-dynamic";

const CLIENTS = [
  "Impala Platinum",
  "Sibanye-Stillwater",
  "Anglo American",
  "Harmony Gold",
  "Generic OHS Act",
];

function today(): string {
  const [y, m, d] = todayIso().split("-");
  return `${d}/${m}/${y}`;
}

export default async function SafetyFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ site?: string; client?: string; project?: string }>;
}) {
  const { org: slug } = await params;
  const ctx = await requireTenant(slug);
  const sp = await searchParams;

  const data = await getSafetyFileData(ctx.org.id, {
    site: sp.site,
    dueSoonDays: ctx.org.due_soon_days,
  });

  const client = sp.client ?? CLIENTS[0];
  const project = sp.project ?? "";
  const canBuild = isAdmin(ctx.role);
  const pdfHref =
    `/${slug}/hr/safety-file/pdf?client=${encodeURIComponent(client)}` +
    (sp.site ? `&site=${encodeURIComponent(sp.site)}` : "") +
    (project ? `&project=${encodeURIComponent(project)}` : "");
  const withEvidence = data.people.filter(
    (p) =>
      p.id_file_path ||
      data.columns.some((c) => p.certs[c.id]?.cert_file_path),
  ).length;

  const outstanding = data.people.flatMap((p) =>
    data.columns
      .map((col) => {
        const cert = p.certs[col.id];
        if (!cert) return null;
        if (cert.status !== "expired") return null;
        return { person: `${p.surname}, ${p.names}`, item: col.name, date: cert.expiry_date };
      })
      .filter((x): x is { person: string; item: string; date: string | null } => x !== null),
  );

  const missingIdCopies = data.people.filter((p) => !p.id_file_path);
  const lapsedDocs = data.people.filter(
    (p) => p.id_expiry !== null && p.id_expiry < todayIso(),
  );

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        <header>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--brand-red)] font-bold">
            {ctx.org.name} - Safety file
          </p>
          <h1 className="mt-2 text-4xl font-black">Build the pack</h1>
          <p className="mt-2 text-[var(--brand-slate)] max-w-2xl">
            Certly drafts the employee half of a contractor safety file from your
            register. Pick the client and the site, check the outstanding list,
            then print to PDF. Company documents, appointments and the risk
            assessment are still yours to attach.
          </p>
        </header>

        <form
          method="get"
          className="bg-white border border-[var(--brand-line)] rounded-2xl p-5 grid sm:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
              Client
            </label>
            <select
              name="client"
              defaultValue={client}
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 bg-white text-sm"
            >
              {CLIENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
              Site
            </label>
            <select
              name="site"
              defaultValue={sp.site ?? ""}
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 bg-white text-sm"
            >
              <option value="">All sites</option>
              {data.sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-[var(--brand-slate)]">
              Project or shaft
            </label>
            <input
              type="text"
              name="project"
              defaultValue={project}
              className="mt-1 w-full border border-[var(--brand-line)] rounded-md p-2.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="border border-[var(--brand-ink)] hover:bg-[var(--brand-ink)] hover:text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
            >
              Rebuild
            </button>
            <PrintButton />
          </div>
        </form>

        {canBuild ? (
          <div className="bg-[var(--brand-ink)] text-white rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-black text-lg">Download the bound pack</p>
              <p className="mt-1 text-sm text-white/70 max-w-xl">
                One PDF: cover, employee list, competency matrix, outstanding
                items, declaration, an evidence index with page numbers, and
                every scanned certificate and identity copy bound in behind it.
                {withEvidence} of {data.totals.people} people have at least one
                document on file.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={pdfHref}
                className="inline-flex items-center gap-2 bg-[var(--brand-red)] hover:bg-[var(--brand-red-deep)] text-white px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Download size={14} />
                Full pack with ID copies
              </a>
              <a
                href={`${pdfHref}&ids=0`}
                className="inline-flex items-center gap-2 border border-white/40 hover:bg-white hover:text-[var(--brand-ink)] px-4 py-2.5 rounded-md font-bold text-sm transition"
              >
                <Download size={14} />
                Without ID copies
              </a>
            </div>
          </div>
        ) : null}

        {outstanding.length > 0 || lapsedDocs.length > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="font-black text-red-800">
              This pack is not submission ready.
            </p>
            <p className="mt-1 text-sm text-red-900">
              {outstanding.length} expired certification
              {outstanding.length === 1 ? "" : "s"}
              {lapsedDocs.length > 0
                ? ` and ${lapsedDocs.length} lapsed identity document${lapsedDocs.length === 1 ? "" : "s"}`
                : ""}
              . Sending it as it stands invites a rejection at the client&rsquo;s
              desk.
            </p>
          </div>
        ) : null}
      </div>

      <article className="print-doc bg-white border border-[var(--brand-line)] rounded-2xl p-8 space-y-8">
        <header className="border-b-2 border-[var(--brand-ink)] pb-5">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brand-slate)]">
                Contractor safety file &middot; employee section
              </p>
              <h2 className="mt-1 text-3xl font-black">{ctx.org.name}</h2>
            </div>
            <dl className="font-mono text-xs text-right space-y-1">
              <div>
                <dt className="inline text-[var(--brand-slate)]">Client: </dt>
                <dd className="inline font-bold">{client}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--brand-slate)]">Site: </dt>
                <dd className="inline font-bold">{sp.site ?? "All sites"}</dd>
              </div>
              {project ? (
                <div>
                  <dt className="inline text-[var(--brand-slate)]">Project: </dt>
                  <dd className="inline font-bold">{project}</dd>
                </div>
              ) : null}
              <div>
                <dt className="inline text-[var(--brand-slate)]">Compiled: </dt>
                <dd className="inline font-bold">{today()}</dd>
              </div>
            </dl>
          </div>
        </header>

        <Section number="11" title="List of employees on this project">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--brand-cream)] text-left">
                <Th>#</Th>
                <Th>Surname</Th>
                <Th>Names</Th>
                <Th>Document</Th>
                <Th>Number</Th>
                <Th>Country</Th>
                <Th>Doc expiry</Th>
                <Th>Designation</Th>
                <Th>Site</Th>
                <Th>Copy</Th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((p, i) => (
                <tr key={p.id} className="border-t border-[var(--brand-line)]">
                  <Td>{i + 1}</Td>
                  <Td className="font-bold">{p.surname}</Td>
                  <Td>{p.names}</Td>
                  <Td>{idTypeLabel(p.id_type)}</Td>
                  <Td className="font-mono">{p.id_number}</Td>
                  <Td>{countryLabel(p.id_country) || "-"}</Td>
                  <Td className="font-mono">{p.id_expiry ?? "-"}</Td>
                  <Td>{p.designation ?? "-"}</Td>
                  <Td>{p.site ?? "-"}</Td>
                  <Td>{p.id_file_path ? "On file" : "Missing"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--brand-slate)]">
            {data.totals.people} people. Identity document copies on file:{" "}
            {data.people.length - missingIdCopies.length} of {data.people.length}.
          </p>
        </Section>

        <Section number="24 / 25 / 28" title="Certificates of competency, medical fitness and training">
          {data.columns.length === 0 ? (
            <p className="text-sm text-[var(--brand-slate)]">
              No certifications on record for this selection.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[var(--brand-cream)] text-left">
                    <Th>Employee</Th>
                    {data.columns.map((c) => (
                      <th
                        key={c.id}
                        className="px-1.5 py-2 font-bold uppercase tracking-wide text-[8px] text-[var(--brand-slate)] align-bottom"
                      >
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.people.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--brand-line)]">
                      <Td className="font-bold whitespace-nowrap">
                        {p.surname}, {p.names.charAt(0)}.
                      </Td>
                      {data.columns.map((c) => {
                        const cert = p.certs[c.id];
                        if (!cert) {
                          return (
                            <td
                              key={c.id}
                              className="px-1.5 py-1.5 text-center text-[var(--brand-slate)]"
                            >
                              -
                            </td>
                          );
                        }
                        const colour =
                          cert.status === "expired"
                            ? "text-red-700 font-bold"
                            : cert.status === "due_soon"
                              ? "text-amber-700 font-bold"
                              : "text-emerald-800";
                        return (
                          <td
                            key={c.id}
                            className={`px-1.5 py-1.5 text-center font-mono ${colour}`}
                          >
                            {cert.expiry_date ?? "n/a"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-[var(--brand-slate)]">
            Cell shows the expiry date. Red is expired, amber is due within{" "}
            {ctx.org.due_soon_days} days, n/a means the training does not expire,
            a dash means no record held.
          </p>
        </Section>

        <Section number="OUT" title="Outstanding items">
          {outstanding.length === 0 && lapsedDocs.length === 0 ? (
            <p className="text-sm">
              Nothing expired in this selection at the date of compiling.
            </p>
          ) : (
            <ul className="text-xs space-y-1">
              {outstanding.map((o) => (
                <li key={`${o.person}-${o.item}`}>
                  <span className="font-bold">{o.person}</span> &middot; {o.item}{" "}
                  &middot; expired {o.date}
                </li>
              ))}
              {lapsedDocs.map((p) => (
                <li key={p.id}>
                  <span className="font-bold">
                    {p.surname}, {p.names}
                  </span>{" "}
                  &middot; {idTypeLabel(p.id_type)} &middot; expired {p.id_expiry}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section number="DEC" title="Declaration">
          <p className="text-xs leading-relaxed">
            The employee records in this section were compiled from{" "}
            {ctx.org.name}&rsquo;s training register on {today()}. They reflect
            the records held on that date. This section does not by itself
            constitute compliance with the Occupational Health and Safety Act 85
            of 1993, the Mine Health and Safety Act 29 of 1996, or any client
            standard, and it does not replace the statutory appointments, risk
            assessment and method statement that complete a safety file.
          </p>
          <div className="mt-8 grid sm:grid-cols-2 gap-10">
            <SignBlock label="Compiled by" />
            <SignBlock label="Appointed person, signature and date" />
          </div>
        </Section>
      </article>
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid">
      <h3 className="flex items-stretch border-y border-[var(--brand-ink)] mb-3">
        <span className="bg-[var(--brand-red)] text-white font-mono text-[10px] font-bold tracking-widest px-2.5 py-1.5">
          {number}
        </span>
        <span className="flex-1 border-l border-[var(--brand-ink)] px-3 py-1.5 text-xs font-black uppercase tracking-widest">
          {title}
        </span>
      </h3>
      {children}
    </section>
  );
}

function SignBlock({ label }: { label: string }) {
  return (
    <div className="border-t border-[var(--brand-ink)] pt-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--brand-slate)]">
        {label}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 font-bold uppercase tracking-wide text-[9px] text-[var(--brand-slate)]">
      {children}
    </th>
  );
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-1.5 ${className}`}>{children}</td>;
}
