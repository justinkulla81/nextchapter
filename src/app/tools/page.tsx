import type { Metadata } from 'next'
import Link from 'next/link'
import { LINK, SeoPage } from '@/components/seo/SeoPage'
import { pageH1, pageMetadata } from '@/lib/seo/keywords'

export const metadata: Metadata = pageMetadata('/tools')

const TOOLS = [
  { href: '/tools/layoff-deadlines', name: 'Layoff deadlines', body: 'Enter your last day to see when to file for unemployment and choose health coverage.' },
  { href: '/tools/cobra-vs-aca-calculator', name: 'COBRA vs ACA calculator', body: 'Compare your COBRA quote with a Marketplace plan after the premium tax credit, and see your deadlines.' },
  { href: '/tools/layoff-runway', name: 'Layoff runway', body: 'See how many months your savings, severance and benefits will last.' },
  { href: '/tools/unemployment-estimator', name: 'Unemployment benefit estimator', body: 'A planning estimate of your weekly benefit and the weeks it can last, by state.' },
  { href: '/tools/salary-converter', name: 'Salary converter', body: 'Hourly to yearly, monthly, weekly and back, for any schedule.' },
  { href: '/tools/pay-check', name: 'Pay check', body: 'See where your salary sits against what employers list for your job title.' },
  { href: '/tools/resume-check', name: 'Résumé check', body: 'Paste your résumé to get a score out of 100 and see what to fix.' },
  { href: '/tools/severance-calculator', name: 'Severance calculator', body: 'Turn years of service and pay into the common range of one to two weeks per year.' },
  { href: '/tools/warn-act-checker', name: 'WARN Act checker', body: 'For employers: is 60 days’ notice of a layoff likely required?' },
  { href: '/unemployment-benefits', name: 'Unemployment benefits by state', body: 'Weekly amount, weeks, waiting week and where to file, for every state.' },
  { href: '/layoffs', name: 'Layoff tracker', body: 'Recent layoffs from WARN notices, by state and employer.' },
  { href: '/funding', name: 'Funding finder', body: 'Relocation, tuition and training money ranked for you.' },
  { href: '/ai-skills', name: 'AI skills data', body: 'Which jobs ask for AI skills and what they pay.' },
]

export default function ToolsPage() {
  return (
    <SeoPage
      trail={[{ name: 'Tools', path: '/tools' }]}
      h1={pageH1('/tools', 'Free job search and layoff tools')}
      lede="Free calculators, trackers and lookups for people who lost a job, are planning a move or are running a layoff."
    >
      <ul className="mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <li key={t.href} className="rounded-xl border border-border bg-white p-5">
            <Link href={t.href} className={`${LINK} font-semibold`}>{t.name}</Link>
            <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
          </li>
        ))}
      </ul>
    </SeoPage>
  )
}
