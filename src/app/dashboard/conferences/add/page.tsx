import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { PageHeader } from '@/components/candidate/PageHeader'
import { QuickAdd } from '@/components/conferences/QuickAdd'
import { firstLinkIn } from '@/lib/conferences/share'

export const metadata: Metadata = { title: 'Add a conference' }

// The share-sheet target: a phone shares a link (in `url`, or inside `text`) to this page. Nothing is fetched until the member presses the button.
export default async function AddConferencePage({ searchParams }: { searchParams: Promise<{ url?: string; text?: string; title?: string; error?: string }> }) {
  await getDashboardData()
  const sp = await searchParams
  const link = firstLinkIn(sp.url) ?? firstLinkIn(sp.text) ?? ''
  return (
    <div className="space-y-8">
      <PageHeader title="Add a conference" intro="Paste or share a link to the conference page. We read the public page and fill in the details for you to check." />
      {sp.error && <p role="alert" className="text-sm text-red-700">That link did not work. Check the address and try again.</p>}
      <QuickAdd initialLink={link} />
    </div>
  )
}
