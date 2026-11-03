import { TrackedLink } from '@/components/marketing/TrackedLink'
import { CompanyInterestFlag } from '@/components/company/CompanyInterestFlag'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
 * button takes them to "Where do you stand?" just below. A link goes to the company's general page, and following the company
 * is the quiet option for people who are only watching.
 */
export function AffectedPrompt({ variant, name, slug }: { variant: LandingVariant; name: string; slug: string }) {
  const properties = { company: slug, variant }
  return (
    <div className="rounded-2xl bg-white p-5 text-navy">
      <p className="text-lg font-semibold">{QUESTION[variant](name)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <TrackedLink
          href="#where-you-stand"
          event="layoff_affected_clicked"
          properties={properties}
          className={cn(buttonVariants({ size: 'lg' }), 'h-12 rounded-full bg-action px-6 text-action-foreground hover:brightness-95')}
        >
          {YES[variant]}
        </TrackedLink>
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
        <CompanyInterestFlag company={name} slug={slug} page="layoffs" quiet />
      </div>
    </div>
  )
}
