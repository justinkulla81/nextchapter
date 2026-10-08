import 'server-only'
import { prisma } from '@/lib/prisma'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { isPersonalEmail } from './college-score'

/**
 * Puts each local workforce (WIOA) board in the CRM as a government
 * organization, with its director and chair as people — business-development
 * contacts, the people who can send displaced workers our way. A board whose
 * area has had a WARN filing in the last year is P2; the rest are in the CRM
 * with no priority set.
 *
 * The directory gives a director and a chair each their own address, so
 * "firstname.lastname" and an office inbox both appear; both are kept as the
 * contact's email, since that is what the board published for them.
 */
export async function addBoardContactsToCrm(budgetMs = 120_000): Promise<{ boards: number; added: number; matched: number; review: number; removed: number }> {
  const started = Date.now()
  const active = new Set(
    (await prisma.warnNotice.groupBy({
      by: ['workforceBoardId'],
      where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    })).map((a) => a.workforceBoardId!),
  )
  const boards = await prisma.workforceBoard.findMany({
    where: { OR: [{ directorName: { not: null } }, { chairName: { not: null } }] },
    // Boards with layoffs first, so a short budget covers the ones that matter.
    orderBy: { name: 'asc' },
  })
  boards.sort((a, b) => Number(active.has(b.id)) - Number(active.has(a.id)))

  const out = { boards: 0, added: 0, matched: 0, review: 0, removed: 0 }
  for (const b of boards) {
    if (Date.now() - started > budgetMs) break
    const people = [
      { name: b.directorName, title: b.directorTitle || 'Executive Director', email: b.directorEmail, phone: b.directorPhone, role: 'Director' },
      { name: b.chairName, title: 'Board Chair', email: b.chairEmail, phone: b.chairPhone, role: 'Chair' },
    ].filter((p) => !!p.name && p.name.trim().split(/\s+/).length >= 2)
    if (!people.length) continue

    const org = await ensureOrg({ name: b.name, type: 'GOVERNMENT', website: b.website, state: b.state })
    const priority = active.has(b.id) ? ('P2' as const) : null
    let touched = false
    for (const p of people) {
      const email = p.email?.trim() || null
      const r = await addContactToCrm({
        fullName: p.name!.trim(),
        title: p.title,
        email,
        phone: p.phone,
        orgId: org.id,
        orgName: org.name,
        roles: ['BD_PARTNER'],
        goals: ['BD'],
        priority,
        note: `${p.role} of ${b.name} (WIOA local workforce board, ${b.state}). From the CareerOneStop directory${b.detailsUrl ? `: ${b.detailsUrl}` : '.'}`
          + (email && !isPersonalEmail(email, p.name!) ? ` The address (${email}) may be an office inbox.` : ''),
      })
      touched = true
      if (r.outcome === 'removed') out.removed++
      else out[r.outcome]++
    }
    if (touched) out.boards++
  }
  return out
}
