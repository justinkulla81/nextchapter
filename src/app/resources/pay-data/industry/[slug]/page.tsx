import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GroupDetail } from '@/components/pay-data/GroupDetail'
import { PAY_DATA, PayDataPending } from '@/components/pay-data/PayDataFrame'
import { loadPayData } from '@/lib/pay-data/load'
import { findGroup } from '@/lib/pay-data/slugs'
import { usd } from '@/lib/pay-data/text'
import { canonical } from '@/lib/seo/canonical'
import { titleMeta } from '@/lib/seo/title'

export const revalidate = 21600
export const dynamicParams = true
export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const d = await loadPayData()
  const g = d && findGroup(d.byIndustry, slug, 'industry')
  if (!g) return { title: 'Industry pay data', robots: { index: false, follow: true } }
  return {
    title: titleMeta(`${g.label} Salaries: Median ${usd(g.p50)}, Pay by Level`),
    description: `${g.label} job postings that state pay: median ${usd(g.p50)}, middle half ${usd(g.p25)} to ${usd(g.p75)}, by level, with sample sizes and a CSV.`.slice(0, 165),
    ...canonical(`${PAY_DATA}/industry/${slug}`),
  }
}

export default async function IndustryPayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await loadPayData()
  if (!d) return <PayDataPending path={`${PAY_DATA}/industry/${slug}`} title="Industry pay" />
  const g = findGroup(d.byIndustry, slug, 'industry')
  if (!g) redirect(`${PAY_DATA}/industry`)
  return <GroupDetail d={d} g={g} cut="industry" />
}
