import { SAMPLE_COMPLIANCE_PACK_TEXT } from '@/lib/marketing/sample-compliance-pack'

// Renders the output of the REAL formatCompliancePackText() formatter
// (src/lib/employer/format-compliance-pack.ts) against synthetic data — the
// exact text an employer_legal user downloads today, just for an invented
// contract. Partners Master Build Script §C3.3: "a sample compliance pack."
export function SampleCompliancePack() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sample compliance record
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          Synthetic data, real format
        </span>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-light-gray bg-navy px-5 py-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-light-blue shadow-sm">
        {SAMPLE_COMPLIANCE_PACK_TEXT}
      </pre>
    </div>
  )
}
