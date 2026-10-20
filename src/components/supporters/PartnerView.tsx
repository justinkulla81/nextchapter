import { Heart, HandHeart, Moon, Ear, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type NeedKind = 'listen' | 'space' | 'distract' | 'cheer' | 'none'

export const NEED_COPY: Record<Exclude<NeedKind, 'none'>, { label: string; line: string; Icon: typeof Ear }> = {
  listen: { label: 'A good listener', line: 'Today a little listening goes a long way. No fixing needed.', Icon: Ear },
  space: { label: 'A little space', line: 'Today is a quiet-focus day. Easy company, no questions about the search.', Icon: Moon },
  distract: { label: 'A distraction', line: 'Today a break from it all would help. Something fun, not about work.', Icon: Sparkles },
  cheer: { label: 'A cheer', line: 'Today a kind word would land well.', Icon: Heart },
}

export interface PartnerViewData {
  memberFirstName: string
  partnerName: string
  headline: string
  stats: { label: string; value: number }[]
  need: NeedKind
  ideas: { id: string; text: string; done?: boolean }[]
  starters: string[]
}

// What a partner sees, on their private page, with no login. One purpose: show up well for
// someone in a search. Numbers only about the search, never names, companies or messages.
export function PartnerView({ data }: { data: PartnerViewData }) {
  const need = data.need === 'none' ? null : NEED_COPY[data.need]
  return (
    <main className="mx-auto max-w-xl space-y-10 px-5 py-10">
      <header className="space-y-3">
        <p className="text-lg font-bold text-ink">NextChapter</p>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink text-balance">{data.memberFirstName}&apos;s week</h1>
        <p className="text-base text-muted-foreground">{data.headline}</p>
        <dl className="grid grid-cols-4 gap-2 pt-1">
          {data.stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/70 px-2 py-3 text-center">
              <dd className="text-2xl font-semibold tabular-nums text-ink">{s.value}</dd>
              <dt className="text-xs leading-tight text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>
      </header>

      <section aria-labelledby="cheer" className="space-y-3">
        <h2 id="cheer" className="font-display text-xl font-semibold text-ink">
          Send {data.memberFirstName} a cheer
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ways to start">
          {data.starters.map((t) => (
            <button key={t} type="button" className="rounded-full border border-border px-3.5 py-1.5 text-sm text-ink hover:bg-muted">
              {t}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="cheer-text">
          Your message
        </label>
        <textarea id="cheer-text" rows={3} maxLength={280} placeholder="A few words are plenty." className="w-full rounded-xl border border-border bg-white p-3.5 text-base" />
        <button type="button" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
          Send cheer
        </button>
      </section>

      <section aria-labelledby="today" className="space-y-3">
        <h2 id="today" className="font-display text-xl font-semibold text-ink">
          What {data.memberFirstName} needs today
        </h2>
        {need ? (
          <div className="flex gap-4 rounded-2xl border border-border p-5">
            <need.Icon className="mt-0.5 size-6 shrink-0 text-ink" aria-hidden />
            <div>
              <p className="text-lg font-semibold text-ink">{need.label}</p>
              <p className="text-base text-muted-foreground">{need.line}</p>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-5 text-base text-muted-foreground">
            {data.memberFirstName} hasn&apos;t asked for anything today. A warm hello is always welcome.
          </p>
        )}
      </section>

      <section aria-labelledby="help" className="space-y-3">
        <h2 id="help" className="font-display text-xl font-semibold text-ink">
          Ways to help this week
        </h2>
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {data.ideas.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 p-4">
              <span className={cn('text-base', i.done ? 'text-muted-foreground line-through' : 'text-ink')}>{i.text}</span>
              <button
                type="button"
                aria-pressed={!!i.done}
                className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium', i.done ? 'border-success text-success' : 'border-border text-ink hover:bg-muted')}
              >
                <HandHeart className="size-4" aria-hidden />
                {i.done ? 'Done' : 'I did this'}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">When you tap &ldquo;I did this&rdquo;, {data.memberFirstName} gets a short, warm note. No pressure either way.</p>
      </section>

      <details className="rounded-2xl bg-muted/60 p-5">
        <summary className="cursor-pointer text-base font-semibold text-ink">Instead of &ldquo;Any news?&rdquo;</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base text-ink">
          <li>&ldquo;What would make today easier?&rdquo;</li>
          <li>&ldquo;Want to talk it through, or take a break from it?&rdquo;</li>
          <li>&ldquo;What&apos;s one thing that went okay this week?&rdquo;</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">Searches are stressful for the people around them too. It is fine to need a break yourself.</p>
      </details>

      <footer className="space-y-1 border-t border-border pt-5 text-sm text-muted-foreground">
        <p>
          You see effort in numbers only. You never see names, companies, messages or setbacks. {data.memberFirstName} controls what you see and can change it any time.
        </p>
        <p>
          <a href="#" className="underline underline-offset-4">
            Pause these updates
          </a>
          {' · '}
          <a href="#" className="underline underline-offset-4">
            Stop receiving them
          </a>
        </p>
      </footer>
    </main>
  )
}
