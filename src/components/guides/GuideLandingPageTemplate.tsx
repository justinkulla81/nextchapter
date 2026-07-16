import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { GuideEmailGate } from '@/components/guides/GuideEmailGate'
import type { GuideLandingContent } from '@/lib/constants/guide-landing-content'

export function GuideLandingPageTemplate({ content }: { content: GuideLandingContent }) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={faqJsonLd} />
      {/* Deliberately no primary nav here — this page is reachable only via
          situational buttons, the /resources index, and search/AI citation,
          never by clicking through the site's main nav. */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <Link href="/resources" className="text-sm text-muted-foreground hover:text-foreground">
            ← All resources
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">{content.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">Last updated {content.lastUpdated}</p>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">
          {content.excerpt.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-light-gray bg-off-white p-6">
          <p className="text-sm font-semibold tracking-wide text-navy uppercase">
            What the full guide covers
          </p>
          <ul className="mt-4 space-y-2">
            {content.outline.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <GuideEmailGate slug={content.slug} guideTitle={content.title} />
        </div>

        {content.faq.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-semibold tracking-tight text-navy">
              Frequently asked questions
            </h2>
            <div className="mt-6 space-y-6">
              {content.faq.map((item) => (
                <div key={item.question}>
                  <p className="font-medium text-foreground">{item.question}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/resources" className="underline underline-offset-4">
            ← All resources
          </Link>
          {' · '}
          <Link href="/" className="underline underline-offset-4">
            NextChapter home
          </Link>
        </div>
      </main>
    </div>
  )
}
