'use server'

import { revalidatePath } from 'next/cache'
import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { captureServerEvent } from '@/lib/posthog/server'
import { addEmployerRelatedOrg, employerOwnOrgIds } from '@/lib/org-claims/related-orgs'
import { MAX_LINK_BATCH } from '@/lib/org-claims/related-suggest-rules'
import type { RelatedState } from '@/app/i/[slug]/(portal)/related-actions'

// Hiring portal › Your network: link every organization ticked in one go. Each link is an invitation to claim its own free page; an
// organization already on NextChapter is connected at once. Nothing is emailed by NextChapter: the invites come back to copy or open as a draft.
export async function linkEmployerSuggested(_prev: RelatedState, f: FormData): Promise<RelatedState> {
  const employer = await getTalentDashboardData()
  const ids = [...new Set(f.getAll('orgId').map(String))].filter((x) => /^[A-Za-z0-9_-]{8,40}$/.test(x)).slice(0, MAX_LINK_BATCH)
  if (ids.length === 0) return { error: 'Pick at least one organization.' }
  const ownCrmOrgIds = await employerOwnOrgIds(employer.companyId)
  let linked = 0
  let already = 0
  let failed = 0
  for (const crmOrgId of ids) {
    const r = await addEmployerRelatedOrg({ employerProfileId: employer.id, ownCrmOrgIds, crmOrgId })
    if (!r.ok) failed += 1
    else {
      linked += 1
      if (r.alreadyOnNextChapter) already += 1
    }
  }
  captureServerEvent(employer.id, 'related_suggestions_linked', { employerId: employer.id, kind: 'employer', selected: ids.length, linked, alreadyOnNextChapter: already, failed })
  revalidatePath('/talent/network')
  revalidatePath('/talent/dashboard')
  if (linked === 0) return { error: 'None of those could be linked. They may no longer have a public page.' }
  const rest = [already ? `${already} already ${already === 1 ? 'has' : 'have'} a portal, so you are connected.` : null, failed ? `${failed} could not be linked.` : null].filter(Boolean).join(' ')
  return { ok: true, message: `Linked ${linked}. Send each one its invite below: when they claim their page, you are connected. ${rest}`.trim() }
}
