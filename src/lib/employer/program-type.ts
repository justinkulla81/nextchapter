// What an employer buys seats for (OutplacementContract.programType).
//   OUTPLACEMENT  people leaving: the job search
//   GROWTH        people staying: promotion and raise prep, internal roles, pivots
//   LEARNING      people staying: a skills plan and courses the employer covers
// The employer sees counts only, whatever the program (min cell 10).
// No server-only imports: email templates and client components read this too.

import type { OutplacementProgramType } from '@prisma/client'

export const PROGRAM_TYPES: OutplacementProgramType[] = ['OUTPLACEMENT', 'GROWTH', 'LEARNING']

export const PROGRAM_TYPE_LABEL: Record<OutplacementProgramType, string> = {
  OUTPLACEMENT: 'Outplacement',
  GROWTH: 'Growth',
  LEARNING: 'Learning',
}

// "{org} has set up a NextChapter ___ benefit for you."
export const PROGRAM_TYPE_BENEFIT: Record<OutplacementProgramType, string> = {
  OUTPLACEMENT: 'outplacement',
  GROWTH: 'career growth',
  LEARNING: 'learning',
}

// The sentence after "NextChapter is ..." when the org hasn't listed its own services.
export const PROGRAM_TYPE_PITCH: Record<OutplacementProgramType, string> = {
  OUTPLACEMENT: 'a job-search platform with resume tools, coaching, a market-difficulty report, and a recruiter network',
  GROWTH: 'a career platform for growing where you are: promotion and raise prep, open roles inside your company, and paths into new functions',
  LEARNING: 'a learning platform: a skills plan for your role and next role, and the courses your employer covers',
}

// Where each program lives in the employer portal.
export const PROGRAM_TYPE_HOME: Record<OutplacementProgramType, string> = {
  OUTPLACEMENT: '/employer',
  GROWTH: '/employer/growth',
  LEARNING: '/employer/learning',
}

export const PROGRAM_TYPE_BLURB: Record<OutplacementProgramType, string> = {
  OUTPLACEMENT: 'Job-search support for people leaving.',
  GROWTH: 'Keep your people: promotion and raise prep, internal roles, and paths into new functions.',
  LEARNING: 'A skills plan for each person and the courses you cover, with completion counts.',
}
