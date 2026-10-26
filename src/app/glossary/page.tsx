import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { GLOSSARY } from '@/lib/seo/glossary'
import { SITE_URL } from '@/lib/seo/facts'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/glossary')

export default function GlossaryPage() {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'Layoff and job search glossary',
    url: `${SITE_URL}/glossary`,
    hasDefinedTerm: GLOSSARY.map((t) => ({ '@type': 'DefinedTerm', name: t.term, description: t.definition, url: `${SITE_URL}/glossary#${t.slug}`, inDefinedTermSet: `${SITE_URL}/glossary` })),
  }
  return (
    <SeoPage
      trail={[{ name: 'Glossary', path: '/glossary' }]}
      h1={pageH1('/glossary', 'Layoff and job search glossary')}
      lede="Plain definitions of the terms people meet after a layoff and during a job search: WARN notice, severance, COBRA, outplacement, executive recruiter, reverse recruiter and more."
      jsonLd={[ld]}
    >
      <nav aria-label="Terms" className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {GLOSSARY.map((t) => <a key={t.slug} href={`#${t.slug}`} className={LINK}>{t.term}</a>)}
      </nav>
      <div className="mt-10 max-w-3xl space-y-8">
        {GLOSSARY.map((t) => (
          <section key={t.slug} id={t.slug} aria-labelledby={`${t.slug}-h`}>
            <h2 id={`${t.slug}-h`} className={H2}>{t.term}</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">{t.definition}</p>
            {t.more && <p className="mt-2 text-sm"><Link href={t.more.href} className={LINK}>{t.more.label}</Link></p>}
          </section>
        ))}
      </div>
    </SeoPage>
  )
}
