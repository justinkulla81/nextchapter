import 'server-only'
import { prisma } from '@/lib/prisma'
import type { HiringCompetencyKey } from '@prisma/client'

// §A8 — "panel coordination assigning each interviewer a different
// competency, so four interviewers don't ask the same question."
const COMPETENCY_ROUND_ROBIN: HiringCompetencyKey[] = ['LEADERSHIP', 'SKILLS_EXECUTION', 'COMMUNICATION', 'ADAPTABILITY', 'OWNERSHIP']

export interface PanelistInput {
  name: string
  email: string
}

// One panel per submission (see InterviewPanel's schema comment). Assigns
// each panelist a distinct competency by round-robin over the five —
// panelist 6+ (beyond one full round) gets no default assignment rather
// than a silently repeated one, since at that point "distinct" is no
// longer possible and a hiring manager should notice and reassign by hand
// rather than have this pretend it's still unique.
export async function createPanel(
  submissionId: string,
  createdByHiringManagerId: string,
  panelists: PanelistInput[]
): Promise<{ error?: string; panelId?: string }> {
  const cleaned = panelists.map((p) => ({ name: p.name.trim(), email: p.email.trim() })).filter((p) => p.name && p.email)
  if (cleaned.length === 0) return { error: 'Add at least one panelist.' }

  const existing = await prisma.interviewPanel.findUnique({ where: { submissionId } })
  if (existing) return { error: 'A panel already exists for this candidate.' }

  const panel = await prisma.interviewPanel.create({
    data: {
      submissionId,
      createdByHiringManagerId,
      panelists: {
        create: cleaned.map((p, i) => ({
          name: p.name,
          email: p.email,
          assignedCompetency: i < COMPETENCY_ROUND_ROBIN.length ? COMPETENCY_ROUND_ROBIN[i] : null,
        })),
      },
    },
  })

  return { panelId: panel.id }
}

export async function getPanel(submissionId: string) {
  return prisma.interviewPanel.findUnique({
    where: { submissionId },
    include: { panelists: { include: { scorecard: true }, orderBy: { createdAt: 'asc' } } },
  })
}
