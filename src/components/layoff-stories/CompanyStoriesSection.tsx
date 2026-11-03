import { TrackedLink } from '@/components/marketing/TrackedLink'
import { FOUND_OUT, FUNCTIONS, LEVELS, MIN_ANSWERS_TO_SHOW, NOTICE_GIVEN, SEVERANCE, WHERE_NOW, labelOf, type StoryNumbers } from '@/lib/layoff-stories/rules'
import type { PublicStory } from '@/lib/layoff-stories/store'

const QUESTION_TITLES: { field: keyof StoryNumbers['questions']; title: string }[] = [
  { field: 'severance', title: 'Severance' }, { field: 'noticeGiven', title: 'Notice' }, { field: 'foundOut', title: 'How people found out' },
  { field: 'whereNow', title: 'Where they are now' }, { field: 'fn', title: 'Functions affected' },
]

/** The invitation to share on a company's layoff page, the numbers people reported once five confirmed, and approved stories when public stories are on. */
export function CompanyStoriesSection({ name, slug, numbers, stories }: { name: string; slug: string; numbers: StoryNumbers; stories: PublicStory[] }) {
  const shown = QUESTION_TITLES.filter((q) => numbers.questions[q.field])
  const href = `/layoffs/stories/new?company=${encodeURIComponent(slug)}&source=company_page`
  return (
    <section aria-labelledby="stories" className="rounded-xl border border-border bg-white p-6">
      <h2 id="stories" className="text-xl font-semibold tracking-tight text-navy">Were you laid off from {name}?</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Tell us what happened: notice, severance, how you were told. Two minutes, private by default.
        {numbers.total >= MIN_ANSWERS_TO_SHOW && <> {numbers.total.toLocaleString('en-US')} people have shared.</>}
      </p>
      <TrackedLink href={href} event="layoff_story_card_clicked" properties={{ company: slug, answers: numbers.total }} className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-white hover:opacity-90">
        Share what happened to you
      </TrackedLink>

      {shown.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-navy">What people laid off from {name} reported</h3>
          <p className="mt-1 text-xs text-muted-foreground">From email-confirmed answers. Not verified by NextChapter. Each question appears once {MIN_ANSWERS_TO_SHOW} people answered it.</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {shown.map((q) => {
              const data = numbers.questions[q.field]!
              const opts = q.field === 'severance' ? SEVERANCE : q.field === 'noticeGiven' ? NOTICE_GIVEN : q.field === 'foundOut' ? FOUND_OUT : q.field === 'whereNow' ? WHERE_NOW : FUNCTIONS
              return (
                <div key={q.field} className="rounded-lg bg-off-white p-4">
                  <dt className="text-sm font-medium text-navy">{q.title} <span className="font-normal text-muted-foreground">· {data.answered} answered</span></dt>
                  <dd className="mt-2 space-y-1 text-sm">
                    {data.counts.slice(0, 5).map((c) => <p key={c.key} className="flex justify-between gap-3"><span>{labelOf(opts, c.key)}</span><span className="tabular-nums text-muted-foreground">{Math.round((c.n / data.answered) * 100)}%</span></p>)}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {stories.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-navy">Stories</h3>
          <ul className="mt-3 space-y-4">
            {stories.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-4">
                <p className="whitespace-pre-line text-sm">{s.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{s.name ? `${s.name}, ${s.title}` : `${labelOf(FUNCTIONS, s.fn)}, ${labelOf(LEVELS, s.level).toLowerCase()}`} · told {s.toldMonth}. Shared by a former employee. Not verified by NextChapter.</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
