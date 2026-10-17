// The badge recruiters and employers see on a Candidate+ Verified member:
// "Evidence 42". Shown only for Verified members (Candidate+ plus at least one
// reference, work sample, imported review or client review).
export function EvidenceBadge({ verified, score }: { verified: boolean; score: number }) {
  if (!verified) return null
  return (
    <span
      className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-success"
      title="Candidate+ Verified: references, work samples or reviews on file. Evidence score out of 100; more evidence scores higher."
    >
      Evidence {score}
    </span>
  )
}
