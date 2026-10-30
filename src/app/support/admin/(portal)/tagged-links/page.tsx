import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { TaggedLinkBuilder } from '@/components/admin/TaggedLinkBuilder'

export const metadata = { title: 'Tagged links' }

// Every campaign link carries its audience and channel so the Funnel page can show who engages most
// and which channel brought them. This page builds those links so nobody types a tag by hand.
export default async function TaggedLinksPage() {
  await requireAdmin()
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tagged links</h1>
        <p className="mt-1 text-muted-foreground">
          Use one of these links for every ad, post and partner. Results show on the{' '}
          <Link href="/support/admin/funnel" className="underline underline-offset-2">
            Funnel page
          </Link>
          , under Campaigns and segments.
        </p>
      </div>
      <TaggedLinkBuilder />
    </div>
  )
}
