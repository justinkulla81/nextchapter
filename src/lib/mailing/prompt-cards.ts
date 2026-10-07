import 'server-only'
import { prisma } from '@/lib/prisma'
import { activeLists, suggestionsFor } from './lists'

export interface PromptCard {
  personId: string
  name: string
  orgName: string | null
  email: string | null
  lastEmailedAt: string | null
  lastSubject: string | null
  onListKeys: string[]
  suggestedKeys: string[]
}

/**
 * Pending "Add to a mailing list?" cards, newest email first, with
 * suggestions re-derived now (roles may have changed since the card was
 * raised) and lists they're already on — in any status — left out.
 */
export async function loadPromptCards(take: number) {
  const [prompts, lists, total] = await Promise.all([
    prisma.mailingListPrompt.findMany({
      where: { status: 'PENDING', person: { deletedAt: null } },
      orderBy: { lastEmailedAt: { sort: 'desc', nulls: 'last' } },
      take,
      include: {
        person: {
          select: {
            fullName: true, email: true,
            affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
            mailingMemberships: { select: { list: { select: { key: true } } } },
          },
        },
      },
    }),
    activeLists(),
    prisma.mailingListPrompt.count({ where: { status: 'PENDING', person: { deletedAt: null } } }),
  ])
  const suggestions = await suggestionsFor(prompts.map((p) => p.personId))
  const activities = await prisma.crmActivity.findMany({
    where: { id: { in: prompts.map((p) => p.lastActivityId).filter((x): x is string => !!x) } }, select: { id: true, subject: true },
  })
  const subjectById = new Map(activities.map((a) => [a.id, a.subject]))
  const activeKeys = new Set(lists.map((l) => l.key))

  const cards: PromptCard[] = prompts
    .map((p) => {
      const on = p.person.mailingMemberships.map((m) => m.list.key)
      return {
        personId: p.personId,
        name: p.person.fullName,
        orgName: p.person.affiliations[0]?.org.name ?? null,
        email: p.person.email,
        lastEmailedAt: p.lastEmailedAt?.toISOString() ?? null,
        lastSubject: p.lastActivityId ? subjectById.get(p.lastActivityId) ?? null : null,
        onListKeys: on,
        suggestedKeys: (suggestions.get(p.personId) ?? ['monthly_update']).filter((k) => activeKeys.has(k) && !on.includes(k)),
      }
    })
    .filter((c) => c.suggestedKeys.length > 0 && c.email)
  return { cards, total, lists: lists.map((l) => ({ id: l.id, key: l.key, name: l.name, audience: l.audience })) }
}
