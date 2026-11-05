import { ABOUT_LIMIT, GROUPS, CHECKS, HEADLINE_LIMIT, HEADLINE_PARTS, WEEK } from '@/lib/linkedin/guide'

// The page's pictures. Plain HTML and CSS (no images to load, readable by a screen reader), in the NextChapter palette:
// navy ink, the tint panels, one action color kept for buttons.

const TONE = {
  sky: 'bg-tint-sky text-navy',
  sun: 'bg-tint-sun text-tint-sun-ink',
  mint: 'bg-tint-mint text-tint-mint-ink',
  plum: 'bg-tint-plum text-tint-plum-ink',
} as const

/** The headline as four blocks, with a worked example and the character budget. */
export function HeadlineAnatomy() {
  const sample = HEADLINE_PARTS.map((p) => p.example).join(' | ')
  return (
    <figure className="rounded-3xl border border-border bg-white p-5 sm:p-6">
      <figcaption className="text-sm font-semibold text-navy">A headline is four parts in one line</figcaption>
      <ol className="mt-4 grid gap-3 sm:grid-cols-4">
        {HEADLINE_PARTS.map((p, i) => (
          <li key={p.label} className={`rounded-2xl p-4 ${TONE[p.tone]}`}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{i + 1}. {p.label}</span>
            <span className="mt-2 block text-base font-semibold leading-snug">{p.example}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-2xl bg-off-white p-4 text-base text-navy">{sample}</p>
      <p className="mt-2 text-sm text-muted-foreground">{sample.length} of {HEADLINE_LIMIT} characters used. Separators (“|” or “·”) keep it readable.</p>
    </figure>
  )
}

/** The About section with the fold: the visible lines are the hook. */
export function AboutFold() {
  return (
    <figure className="rounded-3xl border border-border bg-white p-5 sm:p-6">
      <figcaption className="text-sm font-semibold text-navy">What a visitor sees before “see more”</figcaption>
      <div className="mt-4 rounded-2xl bg-off-white p-4 text-base text-navy">
        <p className="rounded-xl bg-tint-sun p-3 font-semibold text-tint-sun-ink">
          Three quarters running, the plants I supported closed the books in five days instead of twelve. Here is how.
        </p>
        <p className="mt-3 text-sm text-muted-foreground" aria-hidden>… see more</p>
        <div aria-hidden className="mt-3 space-y-2 opacity-60">
          <div className="h-2 w-full rounded bg-border" />
          <div className="h-2 w-11/12 rounded bg-border" />
          <div className="h-2 w-4/5 rounded bg-border" />
        </div>
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-navy sm:grid-cols-3">
        <li className="rounded-xl bg-tint-sun p-3"><span className="font-semibold">Hook.</span> A result or the problem you solve.</li>
        <li className="rounded-xl bg-tint-sky p-3"><span className="font-semibold">Body.</span> Who you help, how, and proof with numbers.</li>
        <li className="rounded-xl bg-tint-mint p-3"><span className="font-semibold">Close.</span> How to reach you, in the text, up to {ABOUT_LIMIT.toLocaleString('en-US')} characters.</li>
      </ul>
    </figure>
  )
}

/** Where the target keywords go: four places, one phrase repeated naturally. */
export function KeywordMap() {
  const places = [
    { name: 'Headline', note: '1 or 2 phrases', tone: 'sky' as const },
    { name: 'About', note: 'in a sentence, not a list', tone: 'sun' as const },
    { name: 'Experience', note: 'in what you did', tone: 'mint' as const },
    { name: 'Skills', note: 'the exact term', tone: 'plum' as const },
  ]
  return (
    <figure className="rounded-3xl border border-border bg-white p-5 sm:p-6">
      <figcaption className="text-sm font-semibold text-navy">Take five postings you want. Find the phrases that repeat. Use them here.</figcaption>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {places.map((p) => (
          <li key={p.name} className={`rounded-2xl p-4 ${TONE[p.tone]}`}>
            <span className="block text-base font-semibold">{p.name}</span>
            <span className="mt-1 block text-sm">{p.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Write for the person first. A phrase forced in until it reads badly costs more than it earns.</p>
    </figure>
  )
}

/** The four groups with their count and time, as a proportional bar. */
export function ChecklistOverview() {
  const rows = GROUPS.map((g) => {
    const items = CHECKS.filter((c) => c.group === g.key)
    return { ...g, count: items.length, minutes: items.reduce((n, c) => n + c.minutes, 0) }
  })
  const total = rows.reduce((n, r) => n + r.minutes, 0)
  const tones = ['bg-tint-sky text-navy', 'bg-tint-sun text-tint-sun-ink', 'bg-tint-mint text-tint-mint-ink', 'bg-tint-plum text-tint-plum-ink']
  return (
    <figure className="rounded-3xl border border-border bg-white p-5 sm:p-6">
      <figcaption className="text-sm font-semibold text-navy">{CHECKS.length} checks, four jobs for your profile, about {Math.round(total / 6) / 10} hours in all</figcaption>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full" role="img" aria-label={rows.map((r) => `${r.label} ${r.minutes} minutes`).join(', ')}>
        {rows.map((r, i) => <div key={r.key} className={tones[i].split(' ')[0]} style={{ width: `${(r.minutes / total) * 100}%` }} />)}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-4">
        {rows.map((r, i) => (
          <li key={r.key} className={`rounded-2xl p-4 ${tones[i]}`}>
            <span className="block text-base font-semibold">{r.label}</span>
            <span className="mt-1 block text-sm">{r.line}</span>
            <span className="mt-2 block text-xs font-semibold">{r.count} checks · {r.minutes} min</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** The seven-day rhythm after the profile is done. */
export function WeekRhythm() {
  return (
    <figure className="rounded-3xl border border-border bg-white p-5 sm:p-6">
      <figcaption className="text-sm font-semibold text-navy">The week after: about 15 minutes a day</figcaption>
      <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-7">
        {WEEK.map((d) => (
          <li key={d.day} className={`rounded-2xl p-3 ${d.minutes === 0 ? 'bg-off-white text-muted-foreground' : 'bg-tint-sky text-navy'}`}>
            <span className="block text-sm font-bold">{d.day}</span>
            <span className="mt-1 block text-sm leading-snug">{d.task}</span>
            {d.minutes > 0 && <span className="mt-2 block text-xs font-semibold">{d.minutes} min</span>}
          </li>
        ))}
      </ol>
    </figure>
  )
}
