// Real artifact for /hiring — a mockup of the generated interview guide
// (§A8: "generated interview guide from Dossier gaps"), synthetic data.
// Partners §C2.5/§C3.2.
export function InterviewGuideMockup() {
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-xl border border-light-gray bg-white shadow-lg">
      <div className="border-b border-light-gray bg-off-white px-5 py-3">
        <p className="text-sm font-semibold text-navy">Interview guide — Jordan M., VP Operations req</p>
        <p className="text-xs text-muted-foreground">Generated from what the Dossier doesn&apos;t cover</p>
      </div>
      <div className="divide-y divide-border">
        <div className="px-5 py-3">
          <p className="text-sm font-medium text-foreground">You: Communication &amp; Collaboration</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Provisional confidence — ask about a time they had to deliver hard news to a cross-functional
            partner who disagreed with the call.
          </p>
        </div>
        <div className="px-5 py-3">
          <p className="text-sm font-medium text-foreground">Priya (panel): Skills &amp; Execution</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirmed by references — spend less time here, go deeper on scale (this org is 3x their last one).
          </p>
        </div>
        <div className="px-5 py-3">
          <p className="text-sm font-medium text-foreground">Reference question worth asking</p>
          <p className="mt-1 text-sm text-muted-foreground">
            &quot;How did they handle it when a plan they built had to change midstream?&quot; — no reference
            has been asked this yet.
          </p>
        </div>
      </div>
    </div>
  )
}
