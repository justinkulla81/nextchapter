import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlatformActivityRow } from '@/lib/platforms/candidate-view'
import { PlatformStagePill } from './PlatformStagePill'
import { PlatformDetectionToggle } from './PlatformDetectionToggle'

const COPY = {
  WORK: {
    title: 'Your fractional work',
    intro: 'Platforms we found in your connected Gmail, and how far you’ve gotten on each: signed up, in vetting, accepted, working, earning.',
    empty: 'Nothing found yet. Once you sign up on a platform like micro1, Toptal or GLG, its emails move you from signed up to accepted to working here automatically.',
  },
  LEARNING: {
    title: 'Your learning',
    intro: 'Courses, certificates, degree programs and training we found in your connected Gmail: enrolled, learning, exam booked, completed.',
    empty: 'Nothing found yet. When you enroll with Coursera, LinkedIn Learning, a university, a bootcamp or a certification body, its emails track your progress here automatically.',
  },
} as const

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

// Everything the inbox sync found for one kind (work or learning),
// including platforms NextChapter doesn't list. Removed detections sit at
// the bottom, faded, with Restore.
export function PlatformActivityPanel({
  kind,
  rows,
  gmailConnected,
}: {
  kind: 'WORK' | 'LEARNING'
  rows: PlatformActivityRow[]
  gmailConnected: boolean
}) {
  const copy = COPY[kind]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.intro}</p>
      </CardHeader>
      <CardContent>
        {!gmailConnected && (
          <p className={rows.length > 0 ? 'mb-3 text-sm text-muted-foreground' : 'text-sm text-muted-foreground'}>
            <Link href="/dashboard/privacy" className="font-medium text-primary underline underline-offset-4">
              Connect Gmail
            </Link>{' '}
            {rows.length > 0
              ? 'to keep this up to date. It stopped updating when Gmail was disconnected.'
              : 'and this fills in on its own. We only read mail from the platforms themselves, and we keep the platform, stage, date and subject line, never the email itself.'}
          </p>
        )}
        {!gmailConnected && rows.length === 0 ? null : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.platformKey} className={row.dismissed ? 'flex flex-wrap items-center gap-x-3 gap-y-1 py-3 opacity-60' : 'flex flex-wrap items-center gap-x-3 gap-y-1 py-3'}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{row.name}</span>
                    {!row.dismissed && <PlatformStagePill status={row} />}
                    {row.dismissed && <span className="text-xs text-muted-foreground">Removed</span>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="size-3 shrink-0" />
                    <span className="truncate">
                      {row.courseTitle ? `${row.courseTitle} · ` : ''}
                      {row.category} · last email {formatDate(row.lastEmailAt)}
                    </span>
                  </p>
                </div>
                <PlatformDetectionToggle platformKey={row.platformKey} name={row.name} dismissed={row.dismissed} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
