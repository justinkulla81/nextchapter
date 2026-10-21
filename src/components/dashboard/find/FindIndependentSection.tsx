import type { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { ActionLink } from '@/components/candidate/ActionLink'
import { FindIndependent } from '@/components/dashboard/find/FindIndependent'
import { FindPartMessage } from '@/components/dashboard/find/FindPartMessage'
import { PageHeaderBoxes } from '@/components/dashboard/PageHeaderBoxes'
import { loadIndependentWork } from '@/lib/interim-work/independent-work-data'
import { boardHref } from '@/lib/jobs/board-url'
import { workTypesParam, type WorkType } from '@/lib/jobs/work-type'

// Loads the independent-work data on the server and shows the redesigned part (FindIndependent). A failed load shows
// a message and a way to retry instead of an empty page; a search that leaves out part-time, contract and advisory
// work says why nothing is here and how to turn it on.
export async function FindIndependentSection({
  profile,
  types,
  urlParams,
}: {
  profile: Awaited<ReturnType<typeof getDashboardData>>
  types: WorkType[]
  urlParams: Record<string, string>
}) {
  let data: Awaited<ReturnType<typeof loadIndependentWork>>
  try {
    data = await loadIndependentWork(profile, types)
  } catch (err) {
    console.error('independent work failed to load', err)
    return (
      <FindPartMessage tone="error" title="We could not load independent work" action={<ActionLink href={boardHref(urlParams, {})} event="find_part_retry_clicked" props={{ part: 'independent' }}>Try again</ActionLink>}>
        <p>Nothing you saved is lost. Try again in a moment.</p>
      </FindPartMessage>
    )
  }
  if (!data) {
    const withIndependent = workTypesParam([...new Set<WorkType>([...types, 'part_time', 'contract', 'advisory'])])
    return (
      <FindPartMessage
        title="Independent work follows your work types"
        action={
          <ActionLink kind="primary" href={boardHref(urlParams, { types: withIndependent })} event="independent_work_types_turned_on" props={{ from: types.join(',') }}>
            Include part-time, contract and advisory
          </ActionLink>
        }
      >
        <p>Your search is set to {types.map((t) => t.replace('_', '-')).join(', ')} work. Add the independent types to see consulting, fractional and advisory options.</p>
      </FindPartMessage>
    )
  }
  return (
    <FindIndependent
      data={data}
      unlocked={!!profile.gigDirectoryUnlockAnswer}
      boardAdvisoryWillingness={profile.boardAdvisoryWillingness}
      boardDiversityOptIn={profile.boardDiversityListingsOptIn}
      workHistory={profile.workHistory}
      headerBoxes={<PageHeaderBoxes pageKey="interim-work" candidateId={profile.id} />}
    />
  )
}
