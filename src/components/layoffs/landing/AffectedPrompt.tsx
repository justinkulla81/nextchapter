import { TrackedLink } from '@/components/marketing/TrackedLink'
import { LayoffAlertForm } from '@/components/layoffs/LayoffAlertForm'
import { AffectedYes } from '@/components/layoffs/landing/AffectedYes'
import type { LandingVariant } from '@/lib/layoffs/landing'

const QUESTION: Record<LandingVariant, (name: string) => string> = {
  layoff: (n) => `Were you affected by the ${n} layoffs?`,
  buyout: (n) => `Were you offered the ${n} buyout?`,
  neither: (n) => `Do you work at ${n}?`,
}

const YES: Record<LandingVariant, string> = {
  layoff: 'Yes, I was affected',
  buyout: 'Yes, I was offered it',
  neither: 'Yes, I work there',
}

/**
 * The hero action on a company layoff page. Most people here were affected, so the question comes first and the one primary
 * button takes them to the questions just below with the first one already answered. A link goes to the company's general page.
 *
 * Most searchers of "<company> layoffs" were not laid off (PostHog, Oct 2026: 66 of 82 search visitors left after one page, 4
 * answered the question). For them the second option is an email when the company files again: one field, no account. It replaced
 * the "Just watching? Follow <company>" link, which needed an account (following stays on the company's /employers page).
 */
export function AffectedPrompt({ variant, name, slug }: { variant: LandingVariant; name: string; slug: string }) {
  const properties = { company: slug, variant }
  return (
    <div className="rounded-2xl bg-white p-5 text-navy">
      <p className="text-lg font-semibold">{QUESTION[variant](name)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <AffectedYes label={YES[variant]} preselect={variant !== 'neither'} properties={properties} />
        <TrackedLink
          href={`/employers/${slug}`}
          event="layoff_company_page_clicked"
          properties={{ ...properties, placement: 'hero' }}
          className="text-sm font-medium text-brand underline underline-offset-4"
        >
          See everything about {name}
        </TrackedLink>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <LayoffAlertForm employer={slug} employerName={name} source="layoffs:company:hero" inline />
      </div>
    </div>
  )
}
