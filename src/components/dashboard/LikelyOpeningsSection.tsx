import type { CandidateProfile } from '@prisma/client'
import { getLikelyOpeningsForCandidate } from '@/lib/likely-openings'
import { TrackedLink } from '@/components/dashboard/TrackedLink'

const TYPE_LABEL = {
  EXEC_DEPARTURE: 'Likely opening',
  EXEC_APPOINTMENT: 'New leadership',
  FUNDING_RAISE: 'New funding',
} as const

/**
 * Roles that aren't posted yet: SEC filings that usually come before a
 * senior search (an officer leaving, a new CEO rebuilding the team, a fresh
 * raise). Reaching out now puts a member in before any posting exists.
 */
export async function LikelyOpeningsSection({ profile }: { profile: CandidateProfile }) {
  const openings = await getLikelyOpeningsForCandidate(profile, { limit: 6 })
  if (openings.length === 0) return null

  return (
    <div id="likely-openings" className="scroll-mt-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Likely openings — not posted yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From public SEC filings. These usually come before a search starts — reach out now, before there&apos;s a
          posting and a crowd.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {openings.map((o) => (
          <li key={o.id} className="space-y-1 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              {o.companyName}
              <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {TYPE_LABEL[o.signalType]}
              </span>
            </p>
            <p className="text-muted-foreground">{o.summary}</p>
            <p className="text-xs text-muted-foreground">
              {o.reason && <>{o.reason} · </>}
              Filed {o.filingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ·{' '}
              <TrackedLink
                href={o.filingUrl}
                external
                event="likely_opening_filing_opened"
                properties={{ likelyOpeningId: o.id, companyName: o.companyName, signalType: o.signalType, source: 'find_my_job' }}
                className="text-primary underline underline-offset-4"
              >
                Read the SEC filing
              </TrackedLink>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
