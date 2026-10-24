// Real artifact for /coaches — a mockup of the generated pre-session brief
// (§A5.2: "auto-generated pre-session brief" built from the seven tracked
// coaching dimensions in §A5.1), synthetic data. Partners §C2.3/§C3.2.
const DIMENSIONS = [
  { label: 'Targeting', status: 'On track', trend: '→' },
  { label: 'Motivation', status: 'Dipped this week', trend: '↓' },
  { label: 'Networking', status: 'Strong', trend: '↑' },
  { label: 'Application volume', status: 'On track', trend: '→' },
  { label: 'Skills', status: 'Named gap: negotiation', trend: '→' },
  { label: 'Narrative', status: 'Improving', trend: '↑' },
  { label: 'Interview practice', status: '2 sessions logged', trend: '→' },
]

export function PreSessionBriefMockup() {
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
      <div className="border-b border-light-gray bg-off-white px-5 py-3">
        <p className="text-sm font-semibold text-navy">Pre-session brief — Jordan M.</p>
        <p className="text-xs text-muted-foreground">Generated before your 2:00pm session</p>
      </div>
      <div className="divide-y divide-border">
        {DIMENSIONS.map((d) => (
          <div key={d.label} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span className="font-medium text-foreground">{d.label}</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {d.status}
              <span aria-hidden="true">{d.trend}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-light-gray bg-off-white px-5 py-3 text-xs text-muted-foreground">
        Suggested opener: motivation dipped after two interviews without offers — worth naming directly.
      </div>
    </div>
  )
}
