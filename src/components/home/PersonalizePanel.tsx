import { TrackedLink } from '@/components/marketing/TrackedLink'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The "This list is not personalized" panel: what an anonymous visitor doesn't get and
// how to get it. Shared by the job search (/jobs) and the public job pages (/jobs/[id]).

export const PERSONALIZE_HREF = '/onboarding/desire?from=jobs_page'

const NOT_INCLUDED = [
  'Job picks chosen for you',
  'A fit score on every job',
  'Career pivot paths from your experience',
  'Introductions and references into companies',
]

const STEPS = [
  { title: 'Upload your résumé', body: 'We read it so you don’t retype your history.' },
  { title: 'Answer a few questions', body: 'What you want, where, and what you won’t do.' },
  { title: 'Create your free account', body: 'Then this same search comes back ranked for you, with a reason on each job.' },
]

export function PersonalizePanel({
  heading = 'This list is not personalized',
  intro = 'Anyone sees these same jobs. Without a profile you don’t get:',
  properties,
  mobileFirst = true,
  positive = false,
  cta = 'Personalize my results',
}: {
  heading?: string
  intro?: string
  /** PostHog properties for jobs_page_personalize_clicked (placement, query, jobId…). */
  properties: Record<string, unknown>
  /** On narrow screens, show the panel above the content beside it (the search list) or below it (a job page). */
  mobileFirst?: boolean
  /** List what a profile gives (checks) instead of what the visitor is missing (crosses). */
  positive?: boolean
  cta?: string
}) {
  return (
    <aside
      className={cn(mobileFirst ? 'order-first' : 'order-last', 'h-fit rounded-2xl border border-border bg-white p-5 lg:order-last lg:sticky lg:top-6')}
      aria-labelledby="jobs-gap-heading"
    >
      <h2 id="jobs-gap-heading" className="font-display text-xl font-semibold">
        {heading}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {NOT_INCLUDED.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className={positive ? 'text-success' : 'text-muted-foreground'}>{positive ? '✓' : '✕'}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-sm font-semibold tracking-widest text-muted-foreground uppercase">How to personalize</h3>
      <ol className="mt-3 space-y-3 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white" aria-hidden>
              {i + 1}
            </span>
            <span>
              <span className="font-semibold">{s.title}.</span> <span className="text-muted-foreground">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">Free, and it takes about five minutes.</p>
      <TrackedLink
        href={PERSONALIZE_HREF}
        event="jobs_page_personalize_clicked"
        properties={properties}
        className={cn(buttonVariants({ size: 'lg' }), 'mt-4 h-12 w-full rounded-full bg-action text-action-foreground hover:brightness-95')}
      >
        {cta}
      </TrackedLink>
    </aside>
  )
}
