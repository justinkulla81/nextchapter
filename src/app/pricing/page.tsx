import Link from 'next/link'
import { StructuredData } from '@/components/StructuredData'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { FAMILY_LABELS, plansForFamily, type PlanFamily } from '@/lib/marketing/plans'
import { canonical } from '@/lib/seo/canonical'

export const metadata = {
  ...canonical('/pricing'),
  title: 'Plans',
  description: 'The plans NextChapter offers for candidates, organizations and employers, and what each includes.',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Plans — NextChapter',
}

const FAMILIES: PlanFamily[] = ['individual', 'organization', 'corporate']

export default function PlansPage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <PublicSiteHeader />

      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Plans</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            NextChapter is free for candidates. Here is what each plan includes.
          </p>
        </div>

        {FAMILIES.map((family) => (
          <section key={family} className="mt-14">
            <h2 className="text-xl font-bold tracking-tight text-navy">{FAMILY_LABELS[family].title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{FAMILY_LABELS[family].blurb}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {plansForFamily(family).map((plan) => (
                <div key={plan.planKey} className="flex flex-col rounded-xl border border-light-gray bg-white p-5 shadow-sm">
                  <p className="font-semibold text-navy">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.audience}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground">
                    {plan.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {plan.addOns.length > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">Add-ons: {plan.addOns.join('; ')}.</p>
                  )}
                  <div className="mt-auto pt-4">
                    <Link href={plan.cta.href} className="text-sm font-medium text-primary underline underline-offset-4">
                      {plan.cta.label} →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/outplacement" className="underline underline-offset-4">
            Outplacement
          </Link>
          {' · '}
          <Link href="/vs" className="underline underline-offset-4">
            Compare providers
          </Link>
          {' · '}
          <Link href="/rfp-template" className="underline underline-offset-4">
            RFP template
          </Link>
          {' · '}
          <Link href="/insights" className="underline underline-offset-4">
            Insights
          </Link>
        </div>
      </main>
    </div>
  )
}
