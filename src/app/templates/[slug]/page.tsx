import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoPage, H2, LINK, ActionBand } from '@/components/seo/SeoPage'
import { TemplateFiller } from '@/components/templates/TemplateFiller'
import { TEMPLATES, guidesFor, templateBySlug } from '@/lib/templates/library'
import { ANCHORS, clusterFor } from '@/lib/seo/keywords'
import { fitDescription } from '@/lib/seo/templates'
import { titleMeta } from '@/lib/seo/title'
import { canonical } from '@/lib/seo/canonical'

// One page per template in src/lib/templates/library.ts. Unknown addresses 404.
export const dynamicParams = false
export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const t = templateBySlug(slug)
  if (!t) return {}
  return { title: titleMeta(t.title), description: fitDescription(t.description), ...canonical(`/templates/${slug}`) }
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = templateBySlug(slug)
  if (!t) notFound()
  const guides = guidesFor(t.slug).map((href) => ({ href, label: ANCHORS[href] ?? clusterFor(href).primary }))
  const related = t.related.map((s) => templateBySlug(s)).filter((x): x is NonNullable<typeof x> => !!x)
  return (
    <SeoPage
      trail={[{ name: 'Templates', path: '/templates' }, { name: t.name, path: `/templates/${t.slug}` }]}
      h1={t.h1}
      lede={t.lede}
      jsonLd={[
        { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
        { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
      ]}
    >
      <TemplateFiller template={t} />
      <section aria-labelledby="tips" className="mt-12">
        <h2 id="tips" className={H2}>How to get it right</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {t.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </section>
      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className={H2}>Questions about this {t.category === 'Layoff' ? 'message' : 'template'}</h2>
        <dl className="mt-4 max-w-3xl space-y-4 text-sm">
          {t.faq.map((f) => (
            <div key={f.q}><dt className="font-medium text-navy">{f.q}</dt><dd className="mt-1 text-muted-foreground">{f.a}</dd></div>
          ))}
        </dl>
      </section>
      {guides.length > 0 && (
        <section aria-labelledby="guides" className="mt-12">
          <h2 id="guides" className={H2}>Read the guide</h2>
          <ul className="mt-4 max-w-3xl list-disc space-y-2 pl-5 text-sm">
            {guides.map((g) => <li key={g.href}><Link href={g.href} className={LINK}>{g.label}</Link></li>)}
          </ul>
        </section>
      )}
      {related.length > 0 && (
        <section aria-labelledby="more" className="mt-12">
          <h2 id="more" className={H2}>More templates</h2>
          <ul className="mt-4 grid max-w-3xl gap-2 text-sm sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.slug}><Link href={`/templates/${r.slug}`} className={LINK}>{r.name}</Link></li>
            ))}
            <li><Link href="/templates" className={LINK}>All templates</Link></li>
          </ul>
        </section>
      )}
      <ActionBand
        title="Get a plan for the whole search"
        body="NextChapter gives you a weekly job search plan, a market reality check for your field, and open jobs matched to you."
        label="Start your free plan"
        href="/start"
        event="seo_candidate_cta_clicked"
        properties={{ source: 'template', template: t.slug }}
      />
    </SeoPage>
  )
}
