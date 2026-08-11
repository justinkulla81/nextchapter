import { pickReachOutContacts, type ReachOutPoolContact } from '@/lib/network/pick-reach-out-contacts'
import { ReachOutCarousel } from '@/components/dashboard/ReachOutCarousel'

// Thin server wrapper: picks the "reach out" pool (starred or previously
// emailed contacts — see pick-reach-out-contacts.ts) and hands it to the
// client-side rotating carousel. Working within real schema constraints:
// SupportNetworkContact has no phone field, and email is usually null on
// CSV-imported rows (LinkedIn privacy-gates that column).
export function NetworkQuickActionsCard({
  contacts,
  initialContactId,
}: {
  contacts: ReachOutPoolContact[]
  initialContactId?: string
}) {
  return <ReachOutCarousel contacts={pickReachOutContacts(contacts)} initialContactId={initialContactId} />
}
