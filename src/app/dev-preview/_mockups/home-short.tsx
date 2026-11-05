import { PreviewShell } from '@/components/candidate/PreviewShell'
import { Module } from '@/components/candidate/Module'
import { HomeNote } from '@/components/candidate/HomeNote'
import { Squiggle } from '@/components/ui/squiggle'
import { FocusNumber } from '@/components/candidate/FocusNumber'
import { handwritingUrl } from '@/lib/email/handwriting'
import { checkinNoteText } from '@/lib/email/margin-note-text'

// Home, shortened to the page contract (docs/candidate-redesign.md): one headline, one next step, and three
// sections at most on the first view. Everything that used to stack above Jobs, Network and Learn (program cards,
// funding, employer interest, portfolio access, reconnect, session impact, the journey card, the weekly focus
// and the sprint) is either the one next step or a row in a "Needs you" strip that exists only when something is pending.
// Sample data.

const chip = 'rounded-full px-2.5 py-0.5 text-xs font-medium'
const more = 'text-sm font-medium text-brand underline underline-offset-4'

const NEEDS_YOU: [string, string, string][] = [
  ['A reference request from Dana Ortiz is waiting', 'Reply to Dana', '#'],
  ['Your outplacement program has a new session on Thursday', 'See the session', '#'],
  ['Northwind asked for your portfolio', 'Review the request', '#'],
]

// paper: phase 3 of the design-elements rollout. The note is on warm paper with a handwritten aside and Victoria's signature,
// and the minutes line leaves the eyebrow for a pale number box. It adds no card (the note and the minutes were already here).
export function HomeTodayShort({ pending = true, paper = false }: { pending?: boolean; paper?: boolean }) {
  const noteText = checkinNoteText(105, 150)
  const aside = paper ? { src: handwritingUrl('', noteText), text: noteText } : null
  return (
    <PreviewShell place="home" entry="today">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Good morning, Maya · Week 3{paper ? '' : ' · 105 of 150 minutes this week'}</p>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance sm:text-4xl">The right role, fast.</h1>
        {paper && <Squiggle className="mt-1" />}
      </header>
      {paper && <FocusNumber done={105} target={150} />}

      <HomeNote
        variant={paper ? 'paper' : 'card'}
        aside={aside}
        title="Tell 5 more people what you’re looking for."
        why="Most roles are filled through a person, not a posting. You said networking is uncomfortable, so this is the one step that moves your search most."
        startLabel="Start"
        startHref="#"
        whyDetail="Your plan is set up for applying. Reaching out is the fastest way to turn applications into interviews. Change what your plan is set up for in Improve your search."
      />

      {pending && (
        <details className="group rounded-2xl border border-border bg-muted/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-base font-semibold text-ink marker:content-none">
            <span>3 things need you</span>
            <span className="text-sm font-medium text-muted-foreground group-open:hidden">Show</span>
            <span className="hidden text-sm font-medium text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border px-5">
            {NEEDS_YOU.map(([t, a, h]) => (
              <li key={t} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="text-base">{t}</span>
                <a href={h} className={more}>{a}</a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Module title="Jobs">
          <ul className="divide-y divide-border">
            {[
              ['Director of Operations', 'Northwind · Applied', 'bg-success/10 text-success'],
              ['VP Operations (advisory)', 'Lattice Labs · Interviewing', 'bg-orange/20 text-ink'],
              ['Head of Delivery', 'Harbor Health · Saved', 'bg-muted text-muted-foreground'],
            ].map(([t, m, c]) => (
              <li key={t} className="py-2.5">
                <p className="text-base font-semibold">{t}</p>
                <p className="text-sm text-muted-foreground"><span className={`${chip} ${c}`}>{m.split(' · ')[1]}</span> {m.split(' · ')[0]}</p>
              </li>
            ))}
          </ul>
          <a href="#" className={more}>Open Jobs</a>
        </Module>
        <Module title="Network">
          <ul className="divide-y divide-border">
            {[['Priya Shah', 'VP Operations, Northwind'], ['Marcus Lee', 'Director, Harbor Health'], ['Dana Ortiz', 'Recruiter, Lattice Labs']].map(([n, r]) => (
              <li key={n} className="py-2.5">
                <p className="text-base font-semibold">{n}</p>
                <p className="text-sm text-muted-foreground">{r}</p>
              </li>
            ))}
          </ul>
          <a href="#" className={more}>Open Network</a>
        </Module>
        <Module title="Learn">
          <ul className="divide-y divide-border">
            {[['Negotiating an operations offer', '20 min left'], ['Interview stories that land', 'Not started'], ['Reading a P&L fast', 'Not started']].map(([n, r]) => (
              <li key={n} className="py-2.5">
                <p className="text-base font-semibold">{n}</p>
                <p className="text-sm text-muted-foreground">{r}</p>
              </li>
            ))}
          </ul>
          <a href="#" className={more}>Open Learn</a>
        </Module>
      </div>
    </PreviewShell>
  )
}

export const HomeTodayShortQuiet = () => <HomeTodayShort pending={false} />
export const HomeTodayPaper = () => <HomeTodayShort paper />
