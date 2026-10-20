'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveReviewSettings } from '@/app/dashboard/in-work/actions'
import { MONTH_NAMES, REVIEW_CADENCES, type ReviewCadence } from '@/lib/in-work/constants'
import type { WorkspaceData } from '@/lib/in-work/workspace-data'
import { ChoiceButtons, Field, NoticeLine, Section, formatDate, selectClass, useRunner } from './shared'
import { ImpactLogTab } from './ImpactLogTab'
import { ReviewPrepTab } from './ReviewPrepTab'
import { SalaryTab } from './SalaryTab'
import { PromotionTab } from './PromotionTab'
import { FeedbackTab } from './FeedbackTab'
import { OutcomeTab } from './OutcomeTab'

export type InWorkTab = 'overview' | 'impact' | 'prep' | 'salary' | 'promotion' | 'feedback' | 'outcome'

const TAB_LABELS: { key: InWorkTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'impact', label: 'Impact log' },
  { key: 'prep', label: 'Review prep' },
  { key: 'salary', label: 'Salary and raise' },
  { key: 'promotion', label: 'Promotion and scope' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'outcome', label: 'Review outcome' },
]

export function InWorkWorkspace({ data, initialTab, redesign = false }: { data: WorkspaceData; initialTab: InWorkTab; redesign?: boolean }) {
  const [tab, setTab] = useState<InWorkTab>(initialTab)

  return (
    <div className="flex flex-col gap-6 pb-12">
      {redesign ? (
        <PageHeader
          title="Reviews and raises"
          intro="Prepare for reviews, ask for a raise, earn the next level and handle feedback. Everything here is private to you and never shown to an employer, recruiter or the community."
          action={
            <button
              type="button"
              onClick={() => {
                posthog.capture('in_work_log_win_clicked', { fromTab: tab, winCount: data.wins.length })
                setTab('impact')
              }}
              className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95"
            >
              Log a win
            </button>
          }
        />
      ) : (
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">In-work workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prepare for reviews, negotiate pay, earn the next level and handle feedback. Everything here is private to you.
          It is never shown to an employer, recruiter or the community.
        </p>
      </div>
      )}

      {!data.inWorkJourney && (
        <p className="rounded-lg border border-border bg-off-white p-3 text-sm text-muted-foreground">
          This workspace is built for people who have a job and want to grow in it. You can use it anyway. To change what
          you are working toward, update your situation on your{' '}
          <Link href="/dashboard/profile" className="font-medium text-brand underline">
            profile
          </Link>
          .
        </p>
      )}

      <nav aria-label="In-work sections" className="flex flex-wrap gap-2">
        {TAB_LABELS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={tab === t.key ? 'page' : undefined}
            onClick={() => setTab(t.key)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key ? 'border-brand bg-brand/10 text-brand' : 'border-border bg-background text-foreground/80 hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview data={data} go={setTab} />}
      {tab === 'impact' && <ImpactLogTab data={data} />}
      {tab === 'prep' && <ReviewPrepTab data={data} />}
      {tab === 'salary' && <SalaryTab />}
      {tab === 'promotion' && <PromotionTab data={data} />}
      {tab === 'feedback' && <FeedbackTab data={data} />}
      {tab === 'outcome' && <OutcomeTab data={data} />}
    </div>
  )
}

function Overview({ data, go }: { data: WorkspaceData; go: (t: InWorkTab) => void }) {
  const next = data.nextCycle
  const openFollowUps = data.outcomes[0]?.followUps.filter((f) => !f.done).length ?? 0
  const openActions = data.feedback.reduce((n, f) => n + f.actionItems.filter((a) => !a.done).length, 0)

  return (
    <div className="space-y-6">
      <Section title="Your review cycle">
        {next ? (
          <div className="space-y-1 text-sm">
            <p className="text-base font-medium text-foreground">
              {next.daysToWindow > 0
                ? `Next review window: ${next.label}, in ${next.daysToWindow} day${next.daysToWindow === 1 ? '' : 's'}.`
                : `Your review window is open now: ${next.label}.`}
            </p>
            <p className="text-muted-foreground">
              {next.exact ? 'This is the date you gave us.' : 'This is our default window until you set a date.'} We suggest
              starting prep by {formatDate(next.prepareOn)}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Set your review month below and we will count down to it.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => go('prep')}>Start review prep</Button>
          <Button variant="outline" onClick={() => go('impact')}>
            Log a win
          </Button>
        </div>
      </Section>

      <Section title="Where things stand">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <Stat label="Wins logged" value={String(data.wins.length)} onClick={() => go('impact')} />
          <Stat label="Feedback actions open" value={String(openActions)} onClick={() => go('feedback')} />
          <Stat label="Review follow-ups open" value={String(openFollowUps)} onClick={() => go('outcome')} />
          <Stat
            label="Promotion gaps still open"
            value={data.plan ? String(data.plan.gapItems.filter((g) => !g.done).length) : 'Not started'}
            onClick={() => go('promotion')}
          />
        </ul>
        {data.carry.recap && <p className="text-sm text-muted-foreground">{data.carry.recap}</p>}
      </Section>

      <ReviewSettings data={data} />
    </div>
  )
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </button>
    </li>
  )
}

function ReviewSettings({ data }: { data: WorkspaceData }) {
  const [cadence, setCadence] = useState<ReviewCadence>(data.settings.cadence)
  const [anchorMonth, setAnchorMonth] = useState<string>(data.settings.anchorMonth ? String(data.settings.anchorMonth) : '')
  const [nextDate, setNextDate] = useState(data.settings.nextReviewDate ?? '')
  const [prompts, setPrompts] = useState(data.settings.promptsEnabled)
  const { pending, notice, run } = useRunner()

  return (
    <Section
      title="Review dates and reminders"
      intro="Tell us when your reviews happen. We email you about three weeks before to help you prepare, and a few days after to ask how it went."
    >
      <div className={cn('space-y-4', pending && 'cursor-wait')}>
        <Field label="How often do you have a review?">
          <ChoiceButtons value={cadence} options={REVIEW_CADENCES} onChange={setCadence} label="Review cadence" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First review month" hint="Leave blank to use February and August.">
            <select className={selectClass} value={anchorMonth} onChange={(e) => setAnchorMonth(e.target.value)}>
              <option value="">Not sure (February and August)</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Next review date" hint="Optional. If you know the exact day, add it.">
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={prompts} onChange={(e) => setPrompts(e.target.checked)} />
          <span>
            Email me before and after each review. Emails are plain, go only to you, and have a neutral subject line.
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveReviewSettings({
                    cadence,
                    anchorMonth: anchorMonth ? Number(anchorMonth) : null,
                    nextReviewDate: nextDate || null,
                    promptsEnabled: prompts,
                  }),
                'Saved.',
              )
            }
          >
            {pending ? 'Saving…' : 'Save review dates'}
          </Button>
          <NoticeLine notice={notice} />
        </div>
      </div>
    </Section>
  )
}
