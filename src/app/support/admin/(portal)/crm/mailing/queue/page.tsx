import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { loadPromptCards } from '@/lib/mailing/prompt-cards'
import { MailingPromptQueue } from '@/components/admin/mailing/MailingPromptQueue'

export default async function MailingQueuePage() {
  await requireAdmin()
  const { cards, lists } = await loadPromptCards(200)
  return (
    <div className="space-y-6">
      <header>
        <Link href="/support/admin/crm/mailing" className="text-sm text-muted-foreground hover:underline">← Monthly Update and mailing lists</Link>
        <h1 className="text-2xl font-semibold">Add to a mailing list?</h1>
        <p className="mt-1 text-sm text-muted-foreground">People you&apos;ve emailed who aren&apos;t on the lists that fit them. Tick several to answer them together.</p>
      </header>
      <MailingPromptQueue cards={cards} lists={lists} />
    </div>
  )
}
