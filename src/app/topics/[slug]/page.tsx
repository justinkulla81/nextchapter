import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionBand, H2, SeoPage } from '@/components/seo/SeoPage'
import { RelatedLinks } from '@/components/seo/RelatedLinks'
import { AuthorByline } from '@/components/seo/AuthorByline'
import { articleJsonLd } from '@/lib/seo/jsonld'
import { pageH1, pageMetadata, pageSeo } from '@/lib/seo/keywords'
import { TOPICS, getTopic } from '@/lib/seo/explainers'

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (!getTopic(slug)) return {}
  const base = pageMetadata(`/topics/${slug}`)
  return { ...base, openGraph: { ...base.openGraph, type: 'article' } }
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = getTopic(slug)
  if (!t) notFound()
  const path = `/topics/${t.slug}`
  const h1 = pageH1(path, t.h1)
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }

  return (
    <SeoPage
      trail={[{ name: 'Topics', path: '/topics' }, { name: h1, path }]}
      h1={h1}
      lede={t.lede}
      jsonLd={[articleJsonLd({ headline: h1, path, description: pageSeo(path).description, dateModified: t.updated }), faqLd]}
    >
      <AuthorByline updated={t.updated} className="mt-3" />
      <div className="mt-10 max-w-3xl space-y-10">
        {t.sections.map((s) => (
          <section key={s.h2}>
            <h2 className={H2}>{s.h2}</h2>
            {s.paragraphs?.map((p) => <p key={p} className="mt-3 text-base leading-relaxed text-foreground">{p}</p>)}
            {s.bullets && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-foreground">
                {s.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            )}
            {s.links && (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-foreground">
                {s.links.map((l) =>
                  l.href.startsWith('http') ? (
                    <li key={l.href}><a href={l.href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-4">{l.label}</a></li>
                  ) : (
                    <li key={l.href}><Link href={l.href} className="text-brand underline underline-offset-4">{l.label}</Link></li>
                  ),
                )}
              </ul>
            )}
          </section>
        ))}
        <section>
          <h2 className={H2}>Frequently asked questions</h2>
          <div className="mt-4 space-y-5">
            {t.faq.map((f) => (
              <div key={f.q}>
                <h3 className="font-medium text-foreground">{f.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <ActionBand title={t.cta.title} body={t.cta.body} label={t.cta.label} href={t.cta.href} event="topic_page_cta_clicked" properties={{ topic: t.slug, href: t.cta.href }} />
      <RelatedLinks path={path} />
    </SeoPage>
  )
}
