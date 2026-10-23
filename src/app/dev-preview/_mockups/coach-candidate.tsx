import { CalendarDays, Check, Video } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'

// Sample data only. This is Dana Whitfield’s side of the session in coach-session.tsx: what Maya Ortiz chose to send.
// It replaces the directives list on the member’s coaching page. Nothing is live.

export function CoachWhatCandidateSees() {
  const steps = [
    ['Decide on controller roles and tell Maya', 'Nov 3', 'You', 'Added to Your week'],
    ['Practise the “why finance leadership” story out loud twice', 'Oct 31', 'You', 'Added to Your week'],
    ['Introduce you to two controllers', 'Nov 2', 'Maya', 'Maya is doing this'],
  ]
  const topics: [string, string, string][] = [
    ['Controller roles', 'Jobs: controller openings in Columbus appear higher in Find a job, with why each fits.', 'accepted'],
    ['Panel interview practice', 'Learn: a short practice for panel interviews, before your Tuesday round.', 'open'],
  ]
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <PageHeader title="Your session with Maya" intro="Maya sent this after your October 29 call. The steps are already in your week." action={<PrimaryButton>Open your week</PrimaryButton>} />

      <Section id="steps" title="What you agreed">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {steps.map(([t, due, who, note]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className={cn('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border', who === 'Maya' ? 'border-dashed border-border' : 'border-border')} aria-hidden />
                <div><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{who === 'You' ? 'Yours' : 'Maya’s'} · due {due}</p></div>
              </div>
              <Chip tone={who === 'You' ? 'good' : 'muted'}>{who === 'You' && <Check className="mr-1 inline size-3" aria-hidden />}{note}</Chip>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Why: these are the steps you and Maya agreed on the call. Yours show up in Your week with their dates, and you tick them off there.</p>
      </Section>

      <Section id="topics" title="Topics Maya heard you want help with">
        <ul className="space-y-3">
          {topics.map(([t, effect, state]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
              <div className="max-w-xl"><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">If you accept: {effect}</p></div>
              <div className="flex gap-2" role="group" aria-label={t}>
                <span className={cn('inline-flex h-10 items-center rounded-lg border px-5 text-sm font-semibold', state === 'accepted' ? 'border-ink bg-ink text-white' : 'border-border text-ink')}>{state === 'accepted' && <Check className="mr-1.5 size-4" aria-hidden />}{state === 'accepted' ? 'Accepted' : 'Accept'}</span>
                <span className="inline-flex h-10 items-center rounded-lg border border-border px-5 text-sm font-semibold text-ink">Dismiss</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Why: topics you accept shape the jobs, people and learning we suggest to you. Dismiss one and we don’t use it. You can change this any time in Account and privacy.</p>
      </Section>

      <Section id="summary" title="Maya’s summary">
        <div className="space-y-3 rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3"><Avatar name="Maya Ortiz" size="sm" /><p className="text-sm font-semibold text-ink">Maya Ortiz · October 29</p></div>
          <p className="max-w-2xl text-base leading-relaxed text-ink">Dana, a good session. You doubled your search time this week by protecting 90 minutes every morning, and that is what moved you into a final round.</p>
          <p className="max-w-2xl text-base leading-relaxed text-ink">We agreed you will look at controller roles alongside director roles for two weeks, and you will practise your “why finance leadership” story aloud before Tuesday’s interview.</p>
          <p className="max-w-2xl text-base leading-relaxed text-ink">The one thing still in the way is reaching out in healthcare finance. I will introduce you to two controllers, so you won’t be starting cold.</p>
        </div>
      </Section>

      <div className="grid gap-4 border-t border-border pt-8 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Message Maya</h2>
          <textarea readOnly rows={3} aria-label="Message to Maya" className="w-full rounded-lg border border-border px-3 py-2 text-base" placeholder="Write to Maya between sessions" />
          <SecondaryButton>Send message</SecondaryButton>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ink">Your next session</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-5">
            <div className="flex items-center gap-3"><CalendarDays className="size-5 text-ink/70" aria-hidden /><div><p className="text-base font-semibold text-ink">Thursday, November 12 · 2:00 pm</p><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Video className="size-4" aria-hidden /> Google Meet · link in your invitation</p></div></div>
            <TextLink>Change the time</TextLink>
          </div>
        </div>
      </div>
    </PreviewShell>
  )
}
