'use client'

import { useState } from 'react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { NeedsYou } from '@/components/candidate/NeedsYou'
import { Chip, Meter, PrimaryButton, SecondaryButton, Section } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'

// Learn, shortened to the page contract (docs/candidate-redesign.md). Sample data.
// Default: the title alone (the intro repeated the card), the featured course with its one-line "Why" and the Start button
// above the fold, the AI-at-work explanation behind "Why this first", and the tune strip as one line below the courses.
// Library: the 17 stacked blocks split by purpose into four tabs, with the conditional prompts in the "Needs you" strip.

const more = 'text-sm font-medium text-brand underline underline-offset-4'

export function LearnShort() {
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <PageHeader title="Skills and courses" />

      <section aria-labelledby="featured" className="space-y-3 rounded-2xl border border-border p-5">
        <Chip tone="warm">Biggest gap</Chip>
        <h2 id="featured" className="font-display text-2xl font-semibold text-ink">Learn supply chain analytics</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> 18 of the 40 jobs that fit you ask for it, and you have not shown it yet. A short course closes that.</p>
        <p className="text-sm text-muted-foreground">Coursera · Free · Your company pays for it</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PrimaryButton>Start the course</PrimaryButton>
          <details className="group text-sm">
            <summary className="cursor-pointer list-none font-medium text-brand underline underline-offset-4 marker:content-none">
              <span className="group-open:hidden">Why this first: AI at work in your role</span>
              <span className="hidden group-open:inline">Hide why this first</span>
            </summary>
            <div className="mt-3 space-y-2 rounded-xl bg-muted/70 p-4 text-base text-ink">
              <p>AI is used on about a third of the tasks in your occupation today.</p>
              <p>11 of the 40 jobs that fit you ask for AI skills, and they pay about 8% more like for like.</p>
              <p className="text-sm text-muted-foreground">Source: Anthropic Economic Index and O*NET. <a href="#" className={more}>Full notice</a></p>
            </div>
          </details>
        </div>
      </section>

      <Section id="more" title="Other courses worth your time">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[['Python for operations', '11 jobs ask for it', 'Coursera · Free'], ['Lean Six Sigma green belt', '9 jobs ask for it', 'ASQ · Paid'], ['Presenting to a board', '7 jobs ask for it', 'LinkedIn Learning · Free']].map(([n, w, m]) => (
            <li key={n} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-base font-semibold text-ink">{n}</p>
                <p className="text-sm text-muted-foreground">{w} · {m}</p>
              </div>
              <SecondaryButton>See the course</SecondaryButton>
            </li>
          ))}
        </ul>
      </Section>

      <p className="rounded-2xl bg-muted/50 px-5 py-3 text-sm text-ink">
        <span className="font-semibold">Closer to hired:</span> courses are picked from the jobs that fit you. Confirm your skills and we stop suggesting things you know.{' '}
        <a href="#" className={more}>Answer two questions</a>
      </p>
      <p className="text-sm text-muted-foreground">You have finished 2 courses. Each one goes on your profile and into your dossier. <a href="#" className={more}>See every course, tool and guide</a></p>
    </PreviewShell>
  )
}

const TABS = ['Courses', 'Interview skills', 'Your progress', 'Pay and degrees'] as const

export function LearnLibrary() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Courses')
  return (
    <PreviewShell place="learn" entry="learn" part="skills">
      <PageHeader title="Every course, tool and guide" />

      <NeedsYou>
        <p className="rounded-xl bg-white p-4 text-base">Your company covers courses. <a href="#" className={more}>See which ones</a></p>
        <p className="rounded-xl bg-white p-4 text-base">Finish your skills inventory to unlock tools for your role. <a href="#" className={more}>Start the inventory</a></p>
      </NeedsYou>

      <div role="tablist" aria-label="Learn" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('rounded-full border px-4 py-1.5 text-sm font-medium', tab === t ? 'border-ink bg-ink text-white' : 'border-border text-muted-foreground hover:bg-muted')}>{t}</button>
        ))}
      </div>

      {tab === 'Courses' && (
        <section aria-label="Courses" className="space-y-5">
          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-ink">Your learning path</h2>
            <p className="text-base text-ink">Operations leadership: step 2 of 5, “Supply chain analytics”.</p>
            <Meter pct={40} label="Learning path progress" />
          </div>
          {[['AI skills your employers ask for', ['Prompting for analysis', 'Automating reports']], ['AI training, at your level', ['AI for managers', 'Responsible AI at work']], ['Tools for your role', ['Excel power tools', 'Tableau basics']]].map(([h, items]) => (
            <div key={h as string} className="space-y-2">
              <h3 className="text-base font-semibold text-ink">{h as string}</h3>
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {(items as string[]).map((n) => <li key={n} className="flex items-center justify-between gap-4 p-4"><span className="text-base text-ink">{n}</span><SecondaryButton>See the course</SecondaryButton></li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === 'Interview skills' && (
        <section aria-label="Interview skills" className="space-y-2">
          <p className="text-base text-ink">Three skills interviewers probe in operations roles, with a short practice for each.</p>
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {['Telling a turnaround story', 'Answering “why are you leaving”', 'Handling the salary question'].map((n) => <li key={n} className="flex items-center justify-between gap-4 p-4"><span className="text-base text-ink">{n}</span><SecondaryButton>Practice</SecondaryButton></li>)}
          </ul>
        </section>
      )}

      {tab === 'Your progress' && (
        <section aria-label="Your progress" className="space-y-3">
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[['2', 'courses finished'], ['3', 'hours this week'], ['1', 'in progress']].map(([v, l]) => <div key={l} className="rounded-xl bg-muted/60 px-2 py-4"><dd className="text-2xl font-semibold tabular-nums text-ink">{v}</dd><dt className="text-xs text-muted-foreground">{l}</dt></div>)}
          </dl>
          <p className="text-sm text-muted-foreground">Finished courses go on your profile and into your dossier.</p>
        </section>
      )}

      {tab === 'Pay and degrees' && (
        <section aria-label="Pay and degrees" className="space-y-2">
          <ul className="divide-y divide-border rounded-2xl border border-border text-base">
            <li className="p-4">Courses that moved pay for people in your role: leadership and analytics, about 6 to 9% more.</li>
            <li className="p-4">Before a graduate degree: what it costs, what it returns, and what a certificate does instead.</li>
          </ul>
        </section>
      )}
    </PreviewShell>
  )
}
