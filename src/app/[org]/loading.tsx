export default function OrgLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-40 bg-[var(--brand-line)] rounded" />
        <div className="h-10 w-80 max-w-full bg-[var(--brand-line)] rounded" />
        <div className="h-4 w-full max-w-xl bg-[var(--brand-line)] rounded" />
      </div>
      <div className="bg-white border border-[var(--brand-line)] rounded-2xl p-6 space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 bg-[var(--brand-cream)] rounded" />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
