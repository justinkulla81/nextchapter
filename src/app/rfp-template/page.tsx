import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { StructuredData } from '@/components/StructuredData'
import { RfpDownloadButton } from '@/components/marketing/RfpDownloadButton'
import { RFP_QUESTIONS, SCORECARD_CRITERIA } from '@/lib/marketing/rfp-template-content'

export const metadata: Metadata = {
  title: 'Outplacement RFP Template & Vendor Evaluation Scorecard — NextChapter',
  description:
    'A free, vendor-neutral RFP template and scorecard for evaluating any outplacement provider — eight questions that separate a real evaluation from a sales pitch.',
  alternates: { canonical: '/rfp-template' },
  openGraph: {
    title: 'Outplacement RFP Template & Vendor Evaluation Scorecard — NextChapter',
    description:
      'A free, vendor-neutral RFP template and scorecard for evaluating any outplacement provider.',
    url: 'https://launchyournextchapter.com/rfp-template',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Outplacement RFP Template & Vendor Evaluation Scorecard',
  description:
    'Eight questions to ask any outplacement vendor, plus a scorecard for comparing finalists side by side.',
  step: RFP_QUESTIONS.map((q) => ({ '@type': 'HowToStep', name: q.question, text: q.whyItMatters })),
}

// Partners Master Build Script §D2.2: "Publish a free Outplacement RFP
// Template and a Vendor Evaluation Scorecard. Make them genuinely useful
// and vendor-neutral in tone... This is the highest-leverage marketing
// asset in the plan." Deliberately does not name NextChapter or any
// competitor anywhere in the questions or scorecard themselves — see
// rfp-template-content.ts's header comment.
export default function RfpTemplatePage() {
  return (
    <div className="flex flex-1 flex-col">
      <StructuredData data={jsonLd} />
      <header className="border-b border-border bg-white print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-6">
          <Link href="/" className="shrink-0">
            <Logo className="text-2xl" />
          </Link>
          <nav className="flex items-center gap-1.5 text-sm">
            <Link href="/outplacement" className="font-medium text-brand hover:text-navy">
              For Employers
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
          Outplacement RFP template &amp; vendor evaluation scorecard
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Free, vendor-neutral, and genuinely usable — run this against any provider you&apos;re evaluating,
          including us. It won&apos;t name a single vendor anywhere in it.
        </p>

        <div className="mt-8">
          <RfpDownloadButton />
        </div>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">The eight questions</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask every finalist the same eight questions, in writing, and compare the answers side by side.
          </p>
          <ol className="mt-6 space-y-6">
            {RFP_QUESTIONS.map((q, i) => (
              <li key={q.question} className="rounded-xl border border-light-gray bg-off-white p-5">
                <p className="font-semibold text-navy">
                  {i + 1}. {q.question}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{q.whyItMatters}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-bold tracking-tight text-navy">Vendor evaluation scorecard</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Score each finalist 1–5 on every criterion below, then compare totals. The PDF includes a printable
            version with room for three vendors.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-semibold text-navy">Criterion</th>
                  <th className="py-2 text-center font-semibold text-navy">Score (1–5)</th>
                </tr>
              </thead>
              <tbody>
                {SCORECARD_CRITERIA.map((c) => (
                  <tr key={c.label} className="border-b border-border align-top">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-foreground">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </td>
                    <td className="py-3 text-center text-muted-foreground">___</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground print:hidden">
          <Link href="/vs" className="underline underline-offset-4">
            See how we&apos;d answer these questions
          </Link>
          {' · '}
          <Link href="/outplacement" className="underline underline-offset-4">
            NextChapter for employers
          </Link>
        </div>
      </main>
    </div>
  )
}
