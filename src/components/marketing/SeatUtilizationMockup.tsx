// A live-data-shaped mockup of the employer reporting screen (see the real
// page at src/app/employer/(app)/reporting/page.tsx, whose card layout and
// copy this deliberately mirrors) with synthetic numbers — Partners Master
// Build Script §C3.3: "a real reporting screenshot or live-data mockup."
// Not a screenshot (so it never goes stale against the real UI's styling)
// and not live data (never real employer/candidate rows on a public page).
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-white/60 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-white">{value}</p>
      {note && <p className="text-xs text-white/50">{note}</p>}
    </div>
  )
}

export function SeatUtilizationMockup() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sample reporting view — Meridian Health, Plus tier
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          Synthetic data, real layout
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-light-gray bg-navy shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-white/10 bg-black/20 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="size-2.5 rounded-full bg-white/20" />
          <span className="ml-2 text-xs font-medium text-white/50">NextChapter for Employers — Reporting</span>
        </div>
        <div className="space-y-6 p-6">
          <div>
            <p className="text-sm font-semibold text-white">Q3 2026 RIF — Corporate</p>
            <p className="mt-0.5 text-xs text-white/50">Plus · 64 seats · updated live</p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Seats" value="64" />
            <Stat label="Activated" value="55" />
            <Stat label="Activation rate" value="86%" />
            <Stat label="Engaged, last 7 days" value="70%" />
          </div>
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide">
              Time to placement, by function and level
            </p>
            <div className="mt-2 space-y-1 text-sm text-white/80">
              <div className="flex justify-between">
                <span>Operations, Director</span>
                <span className="tabular-nums">14 people · 61 days avg</span>
              </div>
              <div className="flex justify-between">
                <span>Finance, Manager</span>
                <span className="tabular-nums">11 people · 48 days avg</span>
              </div>
            </div>
          </div>
          <p className="border-t border-white/10 pt-3 text-xs text-white/40">
            Aggregate only, minimum cell size 10. No individual&apos;s activity, grade, or usage is ever
            visible here.
          </p>
        </div>
      </div>
    </div>
  )
}
