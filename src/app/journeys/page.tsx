import Link from 'next/link'
import { LINK, SeoPage } from '@/components/seo/SeoPage'
import { pageMetadata } from '@/lib/seo/keywords'
import { EMPLOYEE_JOURNEYS } from '@/lib/journeys/employee-journeys'

export const metadata = pageMetadata('/journeys')

export default function JourneysIndexPage() {
  return (
    <SeoPage
      trail={[{ name: 'Journeys', path: '/journeys' }]}
      h1="White-collar journeys: rights, benefits, pay and side income"
      lede="Four things that shape a professional’s working life, each with the latest stories, the numbers behind them and a way to see where you stand."
    >
      <ul className="mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {EMPLOYEE_JOURNEYS.map((j) => (
          <li key={j.slug} className="rounded-xl border border-border bg-white p-5">
            <h2 className="text-lg font-semibold tracking-tight text-navy">
              <Link href={`/journeys/${j.slug}`} className={LINK}>{j.label}</Link>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{j.lede}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted-foreground">
        More: <Link href="/news" className={LINK}>all news</Link>, <Link href="/topics" className={LINK}>topics</Link> and the <Link href="/layoffs" className={LINK}>layoff tracker</Link>.
      </p>
    </SeoPage>
  )
}
