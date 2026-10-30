import type { Metadata } from 'next'
import Link from 'next/link'
import { SeoPage, H2, LINK } from '@/components/seo/SeoPage'
import { PromptPack } from '@/components/tools/PromptPack'
import occupations from '@/lib/ai-check/occupations.json'
import { checkPath } from '@/lib/ai-check/slug'
import { SITE, type PromptJob } from '@/lib/ai-check/prompts'
import { AI_EXPOSURE_SOURCE } from '@/lib/skills/ai-exposure'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools/ai-job-check/prompts')

const JOBS: PromptJob[] = [...occupations].sort((a, b) => a.title.localeCompare(b.title)).map((o) => ({ title: o.title, url: `${SITE}${checkPath(o.title, o.soc)}` }))

export default function PromptPackPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }, { name: 'AI job check', path: '/tools/ai-job-check' }, { name: 'Prompts', path: '/tools/ai-job-check/prompts' }]}
      h1={pageH1('/tools/ai-job-check/prompts', 'Free AI prompts for a job search after a layoff')}
      lede={<p className="max-w-3xl">Twelve prompts to paste into any AI assistant, with your résumé or your situation. Each one sends the assistant to the numbers on a NextChapter page and asks it to cite them, so the answer rests on real figures instead of a guess.</p>}
    >
      <section aria-labelledby="pack" className="mt-10 max-w-3xl">
        <h2 id="pack" className={H2}>The prompts</h2>
        <div className="mt-4">
          <PromptPack jobs={JOBS} />
        </div>
      </section>
      <section aria-labelledby="where" className="mt-10 max-w-3xl">
        <h2 id="where" className={H2}>Where the numbers come from</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          AI exposure: <a href={AI_EXPOSURE_SOURCE.url} className={LINK} rel="noopener">{AI_EXPOSURE_SOURCE.name}</a>, {AI_EXPOSURE_SOURCE.released}. Pay, growth and openings: Bureau of Labor Statistics. Layoff notices: WARN filings with state labor departments. <Link href="/tools/ai-job-check" className={LINK}>Check your job</Link>.
        </p>
      </section>
    </SeoPage>
  )
}
