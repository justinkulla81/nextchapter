import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PersonaOnboardingCta } from '@/components/start/PersonaOnboardingCta'
import { PERSONAS, getPersona } from '@/lib/constants/personas'
import { PublicSiteHeader } from '@/components/marketing/PublicSiteChrome'
import { StructuredData } from '@/components/StructuredData'
import { breadcrumbJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'
import { PERSONA_FAQ } from '@/lib/constants/persona-faq'
import { RelatedLinks } from '@/components/seo/RelatedLinks'

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona: string }>
}): Promise<Metadata> {
  const { persona: slug } = await params
  const persona = getPersona(slug)
  if (!persona) return {}
  return pageMetadata(`/start/${persona.slug}`)
}

export default async function PersonaPage({ params }: { params: Promise<{ persona: string }> }) {
  const { persona: slug } = await params
  const persona = getPersona(slug)
  if (!persona) notFound()
  const faq = PERSONA_FAQ[persona.slug] ?? []

  return (
    <div className="flex flex-1 flex-col">
      {/* /start has no page of its own, so the trail is Home › this page. */}
      <StructuredData data={breadcrumbJsonLd([{ name: pageH1(`/start/${persona.slug}`, persona.headline), path: `/start/${persona.slug}` }])} />
      {faq.length > 0 && <StructuredData data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }} />}
      <PublicSiteHeader />

      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-sm font-semibold tracking-widest text-brand uppercase">{persona.label}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-navy sm:text-4xl">{pageH1(`/start/${persona.slug}`, persona.headline)}</h1>
        <div className="mx-auto mt-6 max-w-xl space-y-4 text-left text-muted-foreground">
          {persona.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-8">
          <PersonaOnboardingCta persona={persona.slug} situation={persona.situation} />
        </div>
      </div>

      {persona.slug === 'laid-off' && (
        <div className="mx-auto w-full max-w-2xl px-6 pb-12">
          <div className="rounded-xl border border-light-gray bg-off-white p-5 text-left text-sm">
            <p className="font-medium text-foreground">Practical first steps</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li><Link href="/unemployment-benefits" className="text-brand underline underline-offset-4">Unemployment benefits by state: weekly amounts, weeks and how to file</Link></li>
              <li><Link href="/layoffs" className="text-brand underline underline-offset-4">Layoff tracker: WARN notices by state and employer</Link></li>
            </ul>
          </div>
        </div>
      )}

      {faq.length > 0 && (
        <div className="mx-auto w-full max-w-2xl px-6 pb-8">
          <h2 className="text-xl font-semibold tracking-tight text-navy">Common questions</h2>
          <div className="mt-4 space-y-4">
            {faq.map((f) => (
              <div key={f.q}>
                <h3 className="font-medium text-foreground">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-6 pb-8">
        <RelatedLinks path={`/start/${persona.slug}`} className="mt-4" />
      </div>

      <div className="mx-auto max-w-2xl px-6 pb-16">
        <p className="text-center text-sm text-muted-foreground">Not quite you?</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          {PERSONAS.filter((p) => p.slug !== persona.slug).map((p) => (
            <Link
              key={p.slug}
              href={`/start/${p.slug}`}
              className="rounded-full border border-light-gray px-4 py-1.5 text-sm text-foreground hover:border-brand/40"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
