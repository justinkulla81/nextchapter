import { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'

const DESTINATION_LABEL: Record<(typeof EXPORT_DESTINATIONS)[number], string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  bullhorn: 'Bullhorn',
}

// §A6.2 — "branded submission packet ... generated with the recruiter's own
// logo ... one-click export to Greenhouse/Lever/Bullhorn." Plain anchor
// links to the two download API routes (src/app/api/recruiters/
// submission-packet and .../ats-export) — a real file download, no client
// JS needed, matching how "View resume" is already handled on this same
// page. Never includes Market Reality Grade/component grades/detections/
// badges/application history — see submission-packet.ts's allowlist.
export function SubmissionPacketPanel({
  candidateId,
  enabledDestinations,
}: {
  candidateId: string
  enabledDestinations: string[]
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted-foreground">
        A branded PDF built only from the Dossier content above — never Market Reality Grade, component grades,
        detections, badges, or application history.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/recruiters/submission-packet?candidateId=${candidateId}`}
          className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-brand-foreground hover:bg-brand/90"
        >
          Download submission packet (PDF)
        </a>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium text-foreground">ATS export</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Downloads a correctly-formatted export file for the fields that platform accepts on candidate creation —
          this completes the submission for you to finish in your own ATS. It is not a live push into
          Greenhouse/Lever/Bullhorn; NextChapter doesn&apos;t hold your ATS API credentials.
        </p>
        {enabledDestinations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Your firm hasn&apos;t been enabled for any ATS export destination yet — ask your NextChapter admin.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {EXPORT_DESTINATIONS.filter((d) => enabledDestinations.includes(d)).map((dest) => (
              <a
                key={dest}
                href={`/api/recruiters/ats-export?candidateId=${candidateId}&destination=${dest}`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
              >
                Export for {DESTINATION_LABEL[dest]}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
