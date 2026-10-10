'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'

/**
 * Records each search, sort or filter on the workforce boards page. The
 * page's controls are plain links and a GET form, so the view itself is the
 * event: one capture per distinct set of parameters.
 */
export function WorkforceBoardsViewTracker(props: {
  q: string; state: string; sort: string; dir: string; window: string; results: number
}) {
  const { q, state, sort, dir, window, results } = props
  useEffect(() => {
    posthog.capture('workforce_boards_viewed', { q: q || null, state: state || null, sort, dir, window, results })
  }, [q, state, sort, dir, window, results])
  return null
}

/** One board's page opened — which boards get looked at, and in what window. */
export function WorkforceBoardOpenedTracker({ boardId, state, window }: { boardId: string; state: string; window: string }) {
  useEffect(() => {
    posthog.capture('workforce_board_opened', { boardId, state, window })
  }, [boardId, state, window])
  return null
}

/** The ranked colleges list, per search, filter or sort. */
export function CollegesViewTracker(props: { q: string; state: string; tier: string; sort: string; contacts: string; theme: string; rel: string; results: number }) {
  const { q, state, tier, sort, contacts, theme, rel, results } = props
  useEffect(() => {
    posthog.capture('colleges_ranked_viewed', { q: q || null, state: state || null, tier, sort, contacts: contacts || null, theme: theme || null, relationship: rel || null, results })
  }, [q, state, tier, sort, contacts, theme, rel, results])
  return null
}

/** The company page's Local partners panel was shown: how many places, and how much it found. */
export function LocalPartnersViewedTracker(props: { companyId: string; areas: number; boards: number; jobCenters: number; districts: number; edos: number; universities: number; sources: string }) {
  const { companyId, areas, boards, jobCenters, districts, edos, universities, sources } = props
  useEffect(() => {
    posthog.capture('company_local_partners_viewed', { companyId, areas, boards, jobCenters, districts, edos, universities, sources })
  }, [companyId, areas, boards, jobCenters, districts, edos, universities, sources])
  return null
}

/** A college's profile card opened on its organization page. */
export function CollegeProfileViewedTracker({ unitid, tier, hasExecEd, hasRetraining }: { unitid: string; tier: string | null; hasExecEd: boolean | null; hasRetraining: boolean | null }) {
  useEffect(() => {
    posthog.capture('college_profile_viewed', { unitid, tier, hasExecEd, hasRetraining })
  }, [unitid, tier, hasExecEd, hasRetraining])
  return null
}
