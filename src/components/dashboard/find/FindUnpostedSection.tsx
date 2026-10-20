import type { CandidateProfile } from '@prisma/client'
import { ActionLink } from '@/components/candidate/ActionLink'
import { FindPartMessage } from '@/components/dashboard/find/FindPartMessage'
import { FindUnposted } from '@/components/dashboard/find/FindUnposted'
import { boardHref } from '@/lib/jobs/board-url'
import { buildUnpostedItems, type UnpostedItem } from '@/lib/jobs/find-unposted'
import { workTypesParam, type WorkType } from '@/lib/jobs/work-type'
import { getLikelyOpeningsForCandidate } from '@/lib/likely-openings'
import { loadOwnContactsByCompany } from '@/lib/likely-openings/contacts-at'

// Loads the likely openings and the member's own contacts on the server and shows the redesigned part (FindUnposted).
// A failed load says so and offers a retry instead of rendering nothing.
export async function FindUnpostedSection({ profile, types, urlParams }: { profile: CandidateProfile; types: WorkType[]; urlParams: Record<string, string> }) {
  const fullTime = types.includes('full_time')
  const includeFullTimeHref = boardHref(urlParams, { types: workTypesParam([...new Set<WorkType>([...types, 'full_time'])]) })
  let items: UnpostedItem[] = []
  if (fullTime) {
    try {
      const [openings, contacts] = await Promise.all([getLikelyOpeningsForCandidate(profile, { limit: 8 }), loadOwnContactsByCompany(profile.id)])
      items = buildUnpostedItems(openings, contacts)
    } catch (err) {
      console.error('likely openings failed to load', err)
      return (
        <FindPartMessage tone="error" title="We could not load these openings" action={<ActionLink href={boardHref(urlParams, {})} event="find_part_retry_clicked" props={{ part: 'unposted' }}>Try again</ActionLink>}>
          <p>Nothing you saved is lost. Try again in a moment.</p>
        </FindPartMessage>
      )
    }
  }
  return <FindUnposted items={items} fullTime={fullTime} includeFullTimeHref={includeFullTimeHref} />
}
