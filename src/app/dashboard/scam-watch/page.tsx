import type { Metadata } from 'next'
import { ShieldAlert, ShieldCheck, Mail } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { EmptyState } from '@/components/ui/empty-state'
import { ScamAlertActions } from '@/components/dashboard/ScamAlertActions'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Scam watch' }

type Signal = { code: string; weight: number; detail: string }

const when = (d: Date) =>
  d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })

export default async function ScamWatchPage() {
  const profile = await getDashboardProfile()

  const [connection, alerts] = await Promise.all([
    prisma.emailConnection.findFirst({
      where: { candidateId: profile.id, disconnectedAt: null },
      select: { needsReconnectAt: true },
    }),
    prisma.scamAlert.findMany({
      where: { candidateId: profile.id, markedLegitAt: null },
      orderBy: { emailDate: 'desc' },
      take: 50,
    }),
  ])

  const open = alerts.filter((a) => !a.acknowledgedAt)
  const handled = alerts.filter((a) => a.acknowledgedAt)

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Scam watch</h1>
        <p className="mt-2 text-muted-foreground">
          Fake recruiters target people who are job hunting. I check recruiter and interview emails in your connected Gmail
          and email you within minutes when one looks fake. Only the emails I flag are kept here, never the full message.
        </p>
      </div>

      {!connection ? (
        <EmptyState
          icon={Mail}
          title="Connect Gmail to turn on scam watch"
          description="I can only warn you about emails I can see. Connecting Gmail is read-only, and you can disconnect any time."
          cta={{ label: 'Connect Gmail in privacy settings', href: '/dashboard/privacy' }}
        />
      ) : connection.needsReconnectAt ? (
        <EmptyState
          icon={Mail}
          title="Reconnect Gmail to keep scam watch running"
          description="Your Gmail connection expired, so I'm not seeing new mail right now."
          cta={{ label: 'Reconnect Gmail in privacy settings', href: '/dashboard/privacy' }}
        />
      ) : open.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing suspicious right now"
          description="Scam watch is on. If a recruiter email looks fake, I'll email you and it will show up here."
        />
      ) : null}

      {open.length > 0 && (
        <section aria-labelledby="open-alerts" className="space-y-4">
          <h2 id="open-alerts" className="text-lg font-semibold text-navy">Needs your attention</h2>
          {open.map((a) => (
            <AlertCard key={a.id} alert={a} showActions />
          ))}
        </section>
      )}

      {handled.length > 0 && (
        <section aria-labelledby="handled-alerts" className="space-y-4">
          <h2 id="handled-alerts" className="text-lg font-semibold text-navy">Already handled</h2>
          {handled.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </section>
      )}
    </div>
  )
}

function AlertCard({
  alert,
  showActions,
}: {
  alert: {
    id: string
    level: 'SUSPICIOUS' | 'LIKELY_FAKE'
    claimedCompany: string | null
    fromAddress: string | null
    subject: string | null
    signals: unknown
    emailDate: Date
  }
  showActions?: boolean
}) {
  const signals = (Array.isArray(alert.signals) ? alert.signals : []) as Signal[]
  const likelyFake = alert.level === 'LIKELY_FAKE'
  return (
    <article className="space-y-3 rounded-xl border border-border bg-white p-5">
      <div className="flex items-start gap-3">
        <ShieldAlert className={cn('mt-0.5 size-5 shrink-0', likelyFake ? 'text-destructive' : 'text-warning')} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-foreground">
            {likelyFake ? 'Likely fake' : 'Looks suspicious'}
            {alert.claimedCompany ? `: claims to be ${alert.claimedCompany}` : ''}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {alert.subject || '(no subject)'} · from {alert.fromAddress || 'unknown sender'} · {when(alert.emailDate)}
          </p>
        </div>
      </div>

      <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
        {signals.slice(0, 5).map((s) => (
          <li key={s.code}>{s.detail}</li>
        ))}
      </ul>

      {showActions && (
        <>
          <p className="text-sm text-muted-foreground">
            Don&apos;t click its links, book through them, reply, or send ID, bank details, or money. To pursue the real role,
            type the company&apos;s own website into your browser.
          </p>
          <ScamAlertActions alertId={alert.id} />
        </>
      )}
    </article>
  )
}
