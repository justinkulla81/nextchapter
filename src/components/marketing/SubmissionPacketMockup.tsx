// Real artifact for /recruiters — a mockup of the branded submission
// packet the recruiter portal actually generates (see
// src/app/recruiters/(app)/search/[candidateId]/page.tsx), with synthetic
// data. Partners §C2.4/§C3.2.
export function SubmissionPacketMockup() {
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-light-gray bg-off-white px-5 py-3">
        <span className="text-sm font-semibold text-navy">Meridian Search Partners</span>
        <span className="text-xs text-muted-foreground">Candidate submission packet</span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-base font-semibold text-foreground">Jordan M. — VP Operations</p>
          <p className="text-sm text-muted-foreground">Available immediately · 4 weeks&apos; notice</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            Dossier-complete
          </span>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
            3 of 3 references available for hiring-manager calls
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          An operations leader who scales process without slowing teams down. References independently
          describe the same pattern: sets a clear bar, gives people room to hit it.
        </p>
        <div className="flex gap-2 border-t border-light-gray pt-3 text-xs text-muted-foreground">
          <span>Export: Greenhouse · Lever · Bullhorn</span>
        </div>
      </div>
    </div>
  )
}
