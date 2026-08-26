import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeMatchScore } from '@/lib/matching/compute-match-score'
import { mapEmployerCompanySizeStringToBand } from '@/lib/scoring/level-rank'
import { candidateWantsRole } from '@/lib/talent/candidate-discovery'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { formatRoleComp } from '@/lib/matching/format-comp'
import { sendRoleMatchEmail } from '@/lib/email/send-role-match-email'
import { STRONG_FIT_THRESHOLD } from '@/lib/jobs/job-fit-bucket'

// Bounds email volume for a single posting — same "small, bounded fan-out"
// convention as the 8/20-style limits elsewhere in this matching family.
const MAX_NOTIFIED_PER_POSTING = 20

const CANDIDATE_SELECT = {
  id: true,
  userId: true,
  firstName: true,
  primaryFunction: true,
  secondaryFunction: true,
  targetFunction: true,
  targetRoleType: true,
  highestLevelReached: true,
  levelRankScore: true,
  isPeopleManager: true,
  remotePreference: true,
  currentCity: true,
  currentState: true,
  openToRelocation: true,
  targetCompMin: true,
  compFlexible: true,
  priorityMaxComp: true,
  priorityWorkLife: true,
} as const

// Fires once, synchronously, right after a role is created — same in-process
// trigger pattern as send-badge-earned-email.ts/send-employer-interest.ts,
// not the scheduled-digest cron family (src/lib/email/dispatch/*). Emails
// every strong-fit candidate regardless of their own Dossier-unlock status —
// locked candidates still get told an opportunity exists, just not what it
// is (see send-role-match-email.ts's locked branch). A transient failure on
// one candidate's email must never block the rest.
export async function triggerRoleMatchNotifications(roleId: string): Promise<void> {
  const role = await prisma.roleProfile.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      roleTitle: true,
      description: true,
      type: true,
      compArrangement: true,
      compMin: true,
      compMax: true,
      primaryFunction: true,
      roleLevel: true,
      remotePolicy: true,
      locationRequirement: true,
      employer: { select: { companyName: true, companySize: true } },
    },
  })
  if (!role) return

  const candidates = await prisma.candidateProfile.findMany({
    where: { recruiterDatabaseOptIn: true, isSampleData: false, assessmentComplete: true },
    select: CANDIDATE_SELECT,
  })

  const employerCompanySizeBand = mapEmployerCompanySizeStringToBand(role.employer.companySize)
  const strongFits = candidates
    .filter((candidate) => candidateWantsRole(candidate, role))
    .map((candidate) => ({ candidate, match: computeMatchScore(candidate, { ...role, employerCompanySizeBand }) }))
    .filter(({ match }) => match.score >= STRONG_FIT_THRESHOLD)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, MAX_NOTIFIED_PER_POSTING)

  const compLabel = formatRoleComp(role)

  await Promise.allSettled(
    strongFits.map(async ({ candidate }) => {
      const dossierStatus = await isDossierUnlocked(candidate.id)
      await sendRoleMatchEmail(
        candidate,
        {
          id: role.id,
          roleTitle: role.roleTitle,
          type: role.type,
          companyName: role.employer.companyName,
          description: role.description,
          compLabel,
        },
        dossierStatus.unlocked
      )
    })
  )
}
