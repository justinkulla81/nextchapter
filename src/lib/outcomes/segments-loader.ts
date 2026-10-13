import 'server-only'
import { prisma } from '@/lib/prisma'
import { deriveSegments, type AgeBandValue, type OutcomeSegment } from './segments'

const MASTERS_RE = /\b(master|m\.?s\.?c?\.?|m\.?a\.?|mba|m\.?eng|ph\.?d|doctor|j\.?d\.?|m\.?d\.?)\b/i

export async function getSegmentsForCandidate(candidateId: string): Promise<OutcomeSegment[]> {
  const [profile, analysis, firstJob, education] = await Promise.all([
    prisma.candidateProfile.findUnique({ where: { id: candidateId }, select: { ageBand: true, currentJobStatus: true } }),
    prisma.resumeAnalysis.findFirst({ where: { candidateId }, orderBy: { createdAt: 'desc' }, select: { seniorityBand: true } }),
    prisma.memberEmployment.findFirst({
      where: { candidateId, startDate: { not: null } },
      orderBy: { startDate: 'asc' },
      select: { startDate: true },
    }),
    prisma.educationEntry.findMany({ where: { candidateId }, select: { degree: true } }),
  ])
  if (!profile) return []
  const yearsExperience = firstJob?.startDate
    ? Math.floor((Date.now() - firstJob.startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null
  return deriveSegments({
    ageBand: (profile.ageBand as AgeBandValue | null) ?? null,
    yearsExperience,
    hasMastersOrHigher: education.some((e) => e.degree && MASTERS_RE.test(e.degree)),
    laidOff: profile.currentJobStatus === 'LAID_OFF',
    seniorityBand: (analysis?.seniorityBand as 'EARLY' | 'MID' | 'SENIOR' | 'EXECUTIVE' | undefined) ?? null,
  })
}
