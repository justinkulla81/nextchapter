import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { runConferenceHeadsUp } from '@/lib/events/run-heads-up'
import { STAGE_SUBJECT } from '@/lib/events/headsup'
import { sendTestReminders } from './actions'

export const maxDuration = 60

/**
 * Preview of the reminder emails: what would go out on the next daily run, to whom, and why. Nothing is sent from here.
 * Emails are off until CONFERENCE_HEADSUP_ENABLED=1; with it on, the daily run sends the first N of this list (the cap).
 */
export default async function ReminderPreviewPage({ searchParams }: { searchParams: Promise<{ test?: string }> }) {
  await requireAdmin()
  const { test } = await searchParams
  let result: Awaited<ReturnType<typeof runConferenceHeadsUp>> | null = null
  let error = ''
  try {
    result = await runConferenceHeadsUp(new Date(), { dryRun: true })
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 600) : String(e)
  }
  const enabled = process.env.CONFERENCE_HEADSUP_ENABLED === '1'
  const plan = result?.plan ?? []
  const byStage = result?.byStage ?? {}
  const cap = result?.cap || 25

  return (
    <div className="space-y-5">
      <header>
        <Link href="/support/admin/crm/events" className="text-sm text-muted-foreground hover:underline">All events</Link>
        <h1 className="text-2xl font-semibold">Reminder emails: what goes out next</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Sending is <strong>{enabled ? 'on' : 'off'}</strong>. Each day at most {cap} emails go out, urgent ones first, and no member gets more than one a week.
          This list is what the next run would send. Nothing is sent from this page.
        </p>
      </header>
      <form action={sendTestReminders} className="flex flex-wrap items-center gap-3">
        <button className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">Send me a test</button>
        <span className="text-xs text-muted-foreground">Sends two sample reminders (a made-up event) to your own address: the early speaking ask and the "how was it" check-in.</span>
        {test === 'sent' && <span className="text-sm text-emerald-700">Sent. Check your inbox.</span>}
        {test === 'failed' && <span className="text-sm text-destructive">The test could not be sent. Check that the email key is set.</span>}
        {test === 'noemail' && <span className="text-sm text-destructive">Your admin account has no email address.</span>}
      </form>
      {error ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">Could not build the preview: <code>{error}</code></p>
      ) : (
        <>
          <p className="text-sm">
            {result ? `${result.members} eligible members, ${plan.length} emails due.` : ''}{' '}
            {Object.entries(byStage).map(([s, n]) => `${s}: ${n}`).join(' · ')}
          </p>
          {plan.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is due today. Reminders start when members save events or when a flagship event for their field is 6 to 9 months out.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {plan.slice(0, 100).map((p, i) => (
                <li key={`${p.member.id}-${p.event.id}-${p.stage}`} className="space-y-0.5 p-3 text-sm">
                  <div className="font-medium">{i < cap ? 'Next run: ' : 'Later: '}{p.member.firstName ?? 'Member'} · {p.stage}</div>
                  <div className="text-xs text-muted-foreground">Subject: {STAGE_SUBJECT[p.stage](p.event.name)} ({p.source === 'match' ? 'matched to their field' : 'they saved or follow it'})</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
