import type { Metadata } from 'next'
import Link from 'next/link'
import { LINK, H2, SeoPage } from '@/components/seo/SeoPage'
import { TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templates/library'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/templates')

export default function TemplatesPage() {
  return (
    <SeoPage
      trail={[{ name: 'Templates', path: '/templates' }]}
      h1={pageH1('/templates', 'Free email and letter templates for a layoff and a job search')}
      lede="Fill in a few blanks and copy a ready-to-send email, letter or LinkedIn post: reference requests, thank-you notes, severance and salary negotiation, and more. Free, no account, and nothing leaves your browser."
    >
      {TEMPLATE_CATEGORIES.map((c) => (
        <section key={c} aria-labelledby={`cat-${c}`} className="mt-10">
          <h2 id={`cat-${c}`} className={H2}>{c === 'Layoff' ? 'After a layoff' : c === 'Job search' ? 'Your job search' : c === 'Interviews' ? 'Interviews' : c === 'Employers' ? 'For employers and managers' : 'Offers and moving on'}</h2>
          <ul className="mt-4 grid max-w-4xl gap-4 sm:grid-cols-2">
            {TEMPLATES.filter((t) => t.category === c).map((t) => (
              <li key={t.slug} className="rounded-xl border border-border bg-white p-4">
                <Link href={`/templates/${t.slug}`} className={`${LINK} font-medium`}>{t.name}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{t.lede}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mt-10 max-w-3xl text-sm text-muted-foreground">
        Looking for a calculator instead? See <Link href="/tools" className={LINK}>all free tools</Link>.
      </p>
    </SeoPage>
  )
}
