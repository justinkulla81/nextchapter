import { ArrowDown, ArrowUp, Check, Lock, Sparkles, Video } from 'lucide-react'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar, Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'
import { cn } from '@/lib/utils'
import { Card, CoachShell, Why } from './coach-shell'

// Sample data only. Dana Whitfield is a made-up member, Maya Ortiz a made-up independent coach. Nothing is live.
// Every figure below stands for something we already hold on a member (effort minutes, pipeline, interviews, the market
// reality report, AI exposure, pay position, dossier traits, the coach's earlier sessions) and appears only if the member
// shared it with her coach. See docs/candidate-redesign.md.

const ROW = 'flex flex-wrap items-start justify-between gap-3 p-4'

// ── 1. Session prep ──────────────────────────────────────────────────────────

function Shared({ ok, children, note }: { ok: boolean; children: React.ReactNode; note?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2 text-sm">
      {ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
      <span className={ok ? 'text-ink' : 'text-muted-foreground'}>
        {children}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
    </li>
  )
}

function Delta({ dir, children }: { dir: 'up' | 'down' | 'new'; children: React.ReactNode }) {
  const Icon = dir === 'up' ? ArrowUp : ArrowDown
  return (
    <li className="flex items-start gap-2 text-sm text-ink">
      {dir === 'new' ? <Sparkles className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden /> : <Icon className="mt-0.5 size-4 shrink-0 text-ink/70" aria-hidden />}
      <span>{children}</span>
    </li>
  )
}

export function CoachSessionPrep() {
  const questions: [string, string][] = [
    ['You doubled your search time this week. What made it easier to get started?', 'Her search effort went from 3 h 10 min to 6 h 40 min since you last met. Asking what worked helps her repeat it.'],
    ['Tuesday’s final round: what do you most want the panel to remember about you?', 'She has a final-round interview on Tuesday, and “communication” is her strongest trait in the dossier (two references said so). It gives her something true to lead with.'],
    ['Controller roles pay about what you earn now and lean less on tasks AI can do. Would you want to look at them?', 'This is the one open decision from last time. Her pay is in range for controller roles, and 7 of 18 tasks in her current work are ones AI can help with.'],
  ]
  return (
    <CoachShell active="clients" trail={<>Clients <span aria-hidden>›</span> Dana Whitfield <span aria-hidden>›</span> <span className="text-ink">Before you meet</span></>}>
      <PageHeader
        title="Before you meet Dana"
        intro="Thursday, October 29 at 2:00 pm · 45 minutes · Google Meet · your fourth session. Built from what Dana has shared with you."
        action={<div className="flex flex-col items-end gap-1.5"><PrimaryButton>Join Meet and open notes</PrimaryButton><span className="text-xs text-muted-foreground">Opens Meet in a new tab and starts your notes</span></div>}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          <Section id="week" title="Where Dana is this week">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="space-y-1"><p className="text-xs text-muted-foreground">Search effort</p><p className="font-display text-2xl font-semibold text-ink">6 h 40 min</p><p className="text-sm text-muted-foreground">of search work this week, 3 h 10 min last week</p></Card>
              <Card className="space-y-1"><p className="text-xs text-muted-foreground">Pipeline</p><p className="font-display text-2xl font-semibold text-ink">11 applied</p><p className="text-sm text-muted-foreground">4 have replied · 2 interviews · 0 offers</p></Card>
              <Card className="space-y-1"><p className="text-xs text-muted-foreground">Interviews</p><p className="font-display text-2xl font-semibold text-ink">Tuesday</p><p className="text-sm text-muted-foreground">Final round. She has hidden the company name.</p></Card>
            </div>
            <Why>effort is minutes of real search work Dana logged or we saw her do (applications, messages to contacts, learning). The pipeline counts her saved and applied jobs.</Why>
            <div className="rounded-2xl bg-muted/60 p-5">
              <p className="mb-2 text-sm font-semibold text-ink">What changed since October 15</p>
              <ul className="space-y-2">
                <Delta dir="up">Search effort doubled, and she logged time on 5 days instead of 3.</Delta>
                <Delta dir="new">A second interview was booked, a final round on Tuesday.</Delta>
                <Delta dir="new">Her market report was refreshed on October 21: her pay moved from “below range” to “in range” after a new Columbus salary update.</Delta>
                <Delta dir="down">No messages to contacts in 9 days. She wrote three in the week after your last session.</Delta>
              </ul>
            </div>
          </Section>

          <Section id="last" title="What you agreed last time">
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {[
                ['Dana', 'Message three former colleagues in healthcare finance', 'Done: 2 of 3 sent', true],
                ['Dana', 'Rewrite the top bullet of her résumé', 'Done October 17', true],
                ['You', 'Introduce Dana to two controllers in your network', 'Open: due last Friday', false],
                ['Dana', 'Decide whether to look at controller roles', 'Open: she hasn’t decided yet', false],
              ].map(([who, what, status, done]) => (
                <li key={what as string} className={ROW}>
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border', done ? 'border-success bg-success text-white' : 'border-border')}>{done && <Check className="size-3" aria-hidden />}</span>
                    <div><p className="text-base font-semibold text-ink">{what}</p><p className="text-sm text-muted-foreground">{who === 'You' ? 'Yours' : 'Dana’s'} · {status}</p></div>
                  </div>
                </li>
              ))}
            </ul>
            <Why>these are the follow-ups from your last notes, checked against what Dana marked done in her plan. Two are still open, one of them yours.</Why>
          </Section>

          <Section id="ask" title="Three questions to start with">
            <ol className="space-y-3">
              {questions.map(([q, why], i) => (
                <li key={q} className="flex gap-4 rounded-2xl border border-border p-5">
                  <span className="font-display text-2xl font-semibold text-ink/40" aria-hidden>{i + 1}</span>
                  <div className="space-y-1.5"><p className="text-base font-semibold text-ink">{q}</p><Why>{why}</Why></div>
                </li>
              ))}
            </ol>
          </Section>

          <div className="space-y-8 border-t border-border pt-8">
            <h2 className="font-display text-2xl font-semibold text-ink">Background for the conversation</h2>
            <div className="grid gap-8 md:grid-cols-2">
              <Section id="market" title="Her market, in plain words">
                <ul className="space-y-4">
                  <li><p className="text-base font-semibold text-ink">Some of her work can be done with AI. Most of it can’t.</p><p className="text-sm text-ink">7 of the 18 main tasks of a finance analyst are routine reporting that AI tools can speed up. The rest, such as advising executives and judging risk, are not.</p><p className="text-xs text-muted-foreground">Source: O*NET task list, scored for AI exposure.</p></li>
                  <li><p className="text-base font-semibold text-ink">Her pay is in range.</p><p className="text-sm text-ink">Her last salary of $128,000 is about 6% above the Columbus median of $120,700 for finance managers. Her $125,000 floor is in range.</p><p className="text-xs text-muted-foreground">Source: BLS wage survey for the Columbus metro area. Sample figures in this preview.</p></li>
                  <li><p className="text-base font-semibold text-ink">This work held up in past downturns.</p><p className="text-sm text-ink">Finance manager openings fell 9% in 2009 and 4% in 2020, less than the 14% and 12% across all jobs.</p><p className="text-xs text-muted-foreground">Source: BLS employment history. Sample figures in this preview.</p></li>
                </ul>
              </Section>
              <Section id="strengths" title="Her strengths, from the dossier">
                <ul className="space-y-4">
                  {[
                    ['Communication', 'Both of her references said she explains numbers to people who aren’t in finance.'],
                    ['Thoroughness', 'She finished every step of her résumé review and sent both reference requests the same day.'],
                    ['Self-awareness', 'How she rates herself matches what her references wrote about her.'],
                  ].map(([t, e]) => (
                    <li key={t}><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-ink">{e}</p></li>
                  ))}
                </ul>
                <Why>the dossier builds from what Dana does and what her references say, not from how she describes herself.</Why>
              </Section>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="What Dana shares">
          <Card className="space-y-2">
            <div className="flex items-center gap-3"><Avatar name="Dana Whitfield" size="sm" /><p className="text-base font-semibold text-ink">Dana Whitfield</p></div>
            <p className="text-sm text-muted-foreground">Week 9 of her search · finance operations director · Columbus</p>
            <p className="text-sm text-muted-foreground">She asked for a coach who “holds me accountable”, so open items come first.</p>
          </Card>
          <Card>
            <h2 className="font-display text-lg font-semibold text-ink">What Dana shares with you</h2>
            <ul className="mt-2 divide-y divide-border">
              <Shared ok>Search effort and pipeline</Shared>
              <Shared ok>Interviews</Shared>
              <Shared ok>Market reality report and AI exposure</Shared>
              <Shared ok>Pay position</Shared>
              <Shared ok>Dossier strengths</Shared>
              <Shared ok={false} note="Dana chose not to share this. Nothing on this page uses it.">Her money situation</Shared>
              <Shared ok={false} note="Confidential mode is on: you see counts and roles, not company names.">Names of companies she applied to</Shared>
            </ul>
            <div className="mt-3"><TextLink>How sharing works for Dana</TextLink></div>
          </Card>
          <Card className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Video className="size-5 text-ink/70" aria-hidden /><div><p className="text-sm font-semibold text-ink">Meet link ready</p><p className="text-xs text-muted-foreground">Added to your calendar when she booked</p></div></div>
            <SecondaryButton>Reschedule</SecondaryButton>
          </Card>
        </aside>
      </div>
    </CoachShell>
  )
}

// ── 2. Notes during and after ────────────────────────────────────────────────

function Capture({ kind, text, at }: { kind: string; text: string; at: string }) {
  return (
    <li className="flex items-start gap-3 p-4">
      <Chip tone="muted">{kind}</Chip>
      <p className="flex-1 text-sm text-ink">{text}</p>
      <span className="text-xs text-muted-foreground">{at}</span>
    </li>
  )
}

function Owner({ who }: { who: 'You' | 'Dana' }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="Owner">
      {(['You', 'Dana'] as const).map((o) => (
        <span key={o} className={cn('rounded-lg border px-3 py-1 text-xs font-semibold', o === who ? 'border-ink bg-ink text-white' : 'border-border text-ink')}>{o}</span>
      ))}
    </div>
  )
}

export function CoachSessionNotes() {
  const followUps: { who: 'You' | 'Dana'; text: string; due: string }[] = [
    { who: 'Dana', text: 'Decide on controller roles and tell Maya', due: 'Nov 3' },
    { who: 'Dana', text: 'Practise the “why finance leadership” story out loud twice', due: 'Oct 31' },
    { who: 'You', text: 'Introduce Dana to two controllers', due: 'Nov 2' },
  ]
  const interests: [string, string, boolean][] = [
    ['Controller roles', '“I could see myself as a controller if it’s steadier.”', true],
    ['Panel interview practice', '“I’ve never done a panel, that’s Tuesday.”', true],
    ['Healthcare finance contacts', '“I know nobody in hospitals.”', false],
  ]
  return (
    <CoachShell active="clients" trail={<>Clients <span aria-hidden>›</span> Dana Whitfield <span aria-hidden>›</span> <span className="text-ink">Session notes</span></>}>
      <PageHeader title="Notes from your session with Dana" intro="Thursday, October 29 · 47 minutes. Capture as you talk, then review the draft. Nothing reaches Dana until you send it." />

      <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-8">
          <Section id="capture" title="Capture">
            <div className="flex flex-wrap gap-2" role="group" aria-label="What are you capturing">
              {['Win', 'Blocker', 'Decision', 'Next step'].map((k, i) => (
                <span key={k} className={cn('inline-flex h-10 items-center rounded-lg border px-5 text-sm font-semibold', i === 2 ? 'border-ink bg-ink text-white' : 'border-border text-ink')}>{k}</span>
              ))}
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              <Capture kind="Win" at="2:06" text="Doubled her search time this week by blocking 90 minutes every morning." />
              <Capture kind="Blocker" at="2:14" text="Has not written to anyone in healthcare finance since our last session. Says she doesn’t know how to start." />
              <Capture kind="Decision" at="2:31" text="Will look at controller roles alongside director roles for two weeks." />
              <Capture kind="Next step" at="2:40" text="Practise the “why finance leadership” story aloud before Tuesday." />
            </ul>
            <label className="block text-sm font-semibold text-ink">Your private notes
              <textarea readOnly rows={3} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-base font-normal" defaultValue="Energy was high today. Careful about pushing controller roles too hard; she brought up the pay cut worry twice." />
            </label>
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" aria-hidden /> Private notes stay with you. They are never part of the summary or anything Dana receives.</p>
          </Section>

          <Section id="import" title="Meet notes">
            <Card className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3"><Video className="size-5 text-ink/70" aria-hidden /><div><p className="text-base font-semibold text-ink">“Notes by Gemini” found for today’s call</p><p className="text-sm text-muted-foreground">Attached to your calendar event after the call ended. We use the notes, not the full transcript.</p></div></div>
              <SecondaryButton>Add to the draft</SecondaryButton>
            </Card>
            <p className="text-sm text-muted-foreground">No Meet notes this time? <TextLink>Paste notes or a transcript</TextLink> from anywhere and we treat them the same way.</p>
          </Section>

          <Section id="draft" title="Summary for Dana">
            <div className="space-y-3 rounded-2xl border border-border p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4" aria-hidden /> Drafted from your four captures and the Meet notes. Edit anything.</p>
              <textarea readOnly rows={7} aria-label="Summary for Dana" className="w-full rounded-lg border border-border px-3 py-2 text-base leading-relaxed" defaultValue={'Dana, a good session. You doubled your search time this week by protecting 90 minutes every morning, and that is what moved you into a final round.\n\nWe agreed you will look at controller roles alongside director roles for two weeks, and you will practise your “why finance leadership” story aloud before Tuesday’s interview.\n\nThe one thing still in the way is reaching out in healthcare finance. I will introduce you to two controllers, so you won’t be starting cold.'} />
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Edited by you: not yet</span><span>3 short paragraphs</span></div>
            </div>
          </Section>
        </div>

        <div className="space-y-8 lg:sticky lg:top-6 lg:self-start">
          <Section id="followups" title="Follow-ups">
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {followUps.map((f) => (
                <li key={f.text} className="space-y-2 p-4">
                  <p className="text-base font-semibold text-ink">{f.text}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2"><Owner who={f.who} /><span className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-ink">Due {f.due}</span></div>
                </li>
              ))}
            </ul>
            <Why>each one has one owner and a date, taken from your “next step” captures and the Meet notes. Dana’s go into her plan; yours stay on your list.</Why>
          </Section>

          <Section id="interests" title="Topics Dana wants help with">
            <ul className="space-y-2">
              {interests.map(([t, q, on]) => (
                <li key={t} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3"><span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold', on ? 'bg-ink text-white' : 'bg-muted text-ink')}>{on && <Check className="size-3.5" aria-hidden />}{t}</span><span className="text-xs font-medium text-muted-foreground">{on ? 'Confirmed' : 'Confirm?'}</span></div>
                  <p className="mt-1.5 text-sm text-muted-foreground">She said: {q}</p>
                </li>
              ))}
            </ul>
            <Why>we found these in the notes. Topics you confirm go to Dana, who can accept or dismiss each one.</Why>
          </Section>

          <Card className="space-y-3 border-ink/30">
            <h2 className="font-display text-lg font-semibold text-ink">What Dana will receive</h2>
            <ul className="space-y-1.5 text-sm text-ink">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Your summary, as you edited it</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />2 to-dos in her plan, with due dates</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />2 confirmed topics to accept or dismiss</li>
              <li className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden /><span className="text-muted-foreground">Not sent: your private notes, the captures, the Meet notes, your own follow-up, the unconfirmed topic</span></li>
            </ul>
            <p className="text-sm text-muted-foreground">She gets it in her NextChapter plan and by email.</p>
            <PrimaryButton>Send to Dana</PrimaryButton>
          </Card>
        </div>
      </div>
    </CoachShell>
  )
}
