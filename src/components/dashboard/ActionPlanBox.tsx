import { SprintActionCompletion } from '@/components/dashboard/SprintActionCompletion'
import { PAGE_ACTION_TYPES, type PageKey } from '@/lib/weekly/action-effort'

// Thin wrapper so every page just passes its pageKey instead of hand-writing
// its own actionTypes array — PAGE_ACTION_TYPES is the single source of
// truth for "what real, doable action lives on this page." Renders nothing
// if the page has no action types mapped (e.g. Portfolio, References) or
// none are currently committed/suggested.
export function ActionPlanBox({ pageKey, candidateId }: { pageKey: PageKey; candidateId: string }) {
  const actionTypes = PAGE_ACTION_TYPES[pageKey]
  if (!actionTypes || actionTypes.length === 0) return null
  return <SprintActionCompletion candidateId={candidateId} actionTypes={actionTypes} />
}
