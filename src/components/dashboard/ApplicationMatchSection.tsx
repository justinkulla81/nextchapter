import { loadApplicationMatchData } from '@/lib/applications/member-view'
import { confirmApplicationSkill } from '@/app/dashboard/search-strategy/application-skill-actions'
import { ApplicationMatchView } from '@/components/dashboard/ApplicationMatchView'

/** Search Strategy's "Your applications: match and gaps". Nothing at all until the member has an application we could read. */
export async function ApplicationMatchSection({ candidateId }: { candidateId: string }) {
  const data = await loadApplicationMatchData(candidateId).catch(() => null)
  if (!data) return null
  return <ApplicationMatchView data={data} onConfirm={confirmApplicationSkill} />
}
