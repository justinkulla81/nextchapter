import type { CurrentJobStatus } from '@prisma/client'

// Maps the candidate's stated situation to the short goal phrase shown in
// the dashboard header ("Your goal is to ___") — most situations reduce to
// the general "get a job," with two situations worded distinctly since the
// framing genuinely differs (a first job vs. a deliberate career change).
export function getGoalLabel(currentJobStatus: CurrentJobStatus | null): string {
  switch (currentJobStatus) {
    case 'NEW_GRADUATE_FIRST_JOB':
      return 'Get Your First Job'
    case 'CAREER_PIVOT':
      return 'Change your career'
    default:
      return 'Get a job'
  }
}
