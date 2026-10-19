import { Lock, ShieldCheck } from 'lucide-react'
import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Chip, PrimaryButton, SecondaryButton, Section, TextLink } from '@/components/candidate/ui'

const KINDS = ['My boss', 'Someone I manage', 'A coworker', 'The workload or culture']

function PrivateLine() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Lock className="size-4 shrink-0" aria-hidden />
      Only you see this. It is never shown to your employer, recruiters or the community.
    </p>
  )
}

export function WorkHelpStart() {
  return (
    <PreviewShell place="help" entry="work" part="start">
      <PageHeader title="A hard situation at work" intro="Say what is going on. We help you see your options, including staying. We do not push you to leave." />
      <section className="space-y-5 rounded-2xl border border-border p-7">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-ink">Who is it about?</h2>
          <div role="group" aria-label="Who it is about" className="flex flex-wrap gap-3">
            {KINDS.map((k, i) => (
              <button key={k} type="button" aria-pressed={i === 0} className={i === 0 ? 'h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white' : 'h-11 rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'}>{k}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="what" className="text-base font-semibold text-ink">What is happening?</label>
          <textarea id="what" rows={4} className="w-full rounded-xl border border-border p-3.5 text-base" defaultValue="My manager keeps taking credit for my work in front of leadership, and my last two reviews did not mention it." />
          <PrivateLine />
        </div>
        <PrimaryButton>Help me think it through</PrimaryButton>
      </section>
      <p className="max-w-xl text-sm text-muted-foreground">We cannot give legal advice. If this involves harassment or discrimination, we will point you to the right people. In crisis? Call or text 988 any time, free.</p>
    </PreviewShell>
  )
}

export function WorkHelpOptions() {
  return (
    <PreviewShell place="help" entry="work" part="options">
      <PageHeader title="Your options" intro="Taking credit for your work is common, and it is usually fixable. Here are four ways forward, easiest first." />
      <section className="space-y-4 rounded-2xl border border-border p-7">
        <Chip tone="good">Start here</Chip>
        <h2 className="font-display text-2xl font-semibold text-ink">Make your work visible in writing</h2>
        <p className="max-w-2xl text-base text-ink"><span className="font-semibold">Why:</span> credit goes to whoever is on record. A short weekly note to your manager and their boss, listing what you shipped, fixes this in most cases without a confrontation.</p>
        <p className="text-sm text-muted-foreground">About 10 minutes a week. Your impact log already holds the facts.</p>
        <PrimaryButton>Draft my first update</PrimaryButton>
      </section>
      <Section id="other" title="If that is not enough">
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {[
            ['Talk to your manager directly', 'Why: they may not know how it lands. We can script the first two sentences.', 'Write the script'],
            ['See if a move inside your company helps', 'Why: a new manager can reset this. Your internal roles are listed.', 'See internal roles'],
            ['Look outside, quietly', 'Why: if nothing changes, you keep your options open. Confidential mode hides your search.', 'Start a private search'],
          ].map(([t, w, a]) => (
            <li key={t} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="max-w-xl"><p className="text-base font-semibold text-ink">{t}</p><p className="text-sm text-muted-foreground">{w}</p></div>
              <SecondaryButton>{a}</SecondaryButton>
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-sm text-muted-foreground">Want to hear from people who have been through this? <TextLink href="/dev-preview/help/work/ask">Ask others, without your name or company</TextLink></p>
    </PreviewShell>
  )
}

export function WorkHelpAsk() {
  return (
    <PreviewShell place="help" entry="work" part="ask">
      <PageHeader title="Ask others who have been there" intro="Check what people will see before anything is posted. Nothing is shared until you say so." />
      <section className="space-y-5 rounded-2xl border border-border p-7">
        <h2 className="font-display text-xl font-semibold text-ink">What others will see</h2>
        <blockquote className="max-w-2xl space-y-1.5 rounded-xl bg-muted p-5">
          <p className="text-base font-semibold text-ink">How do you handle a manager who takes credit for your work?</p>
          <p className="text-base text-ink">I lead operations projects at a mid-size company. In meetings with senior leaders, my manager presents my work as theirs. I have not raised it yet. What worked for you?</p>
        </blockquote>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink">We took out</p>
          <div className="flex flex-wrap gap-2">
            {['Your company name', 'Your manager’s name', 'Your team and city', 'Your exact job title'].map((r) => <Chip key={r} tone="warm">{r}</Chip>)}
          </div>
        </div>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />Posted as <span className="font-semibold">SteadyNavigator412</span>, not your name.</li>
          <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />Seen only by people at your level who work at other companies.</li>
          <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />You can delete it any time.</li>
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryButton>Post this question</PrimaryButton>
          <SecondaryButton>Edit the wording</SecondaryButton>
          <TextLink>Keep it private instead</TextLink>
        </div>
      </section>
    </PreviewShell>
  )
}
