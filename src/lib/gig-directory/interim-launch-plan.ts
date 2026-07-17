import { prisma } from '@/lib/prisma'
import type { CandidateProfile, WorkSample } from '@prisma/client'

export interface LaunchPhase {
  number: number
  title: string
  description: string
  completed: boolean
  cta: { label: string; href: string } | null
}

type ProfileForLaunchPlan = Pick<
  CandidateProfile,
  | 'id'
  | 'gigDirectoryUnlockAnswer'
  | 'interimOfferDefinition'
  | 'linkedinProfileUpToDate'
  | 'interimOutreachStartedAt'
> & { workSamples: Pick<WorkSample, 'id'>[] }

export async function getInterimLaunchPlan(profile: ProfileForLaunchPlan): Promise<LaunchPhase[]> {
  const outreachCount = await prisma.outreachLog.count({ where: { candidateId: profile.id } })

  return [
    {
      number: 1,
      title: 'Reality-check the economics',
      description:
        'Fractional/interim rates typically land well below a full-time equivalent once you annualize the hours. Set a target before you browse.',
      completed: !!profile.gigDirectoryUnlockAnswer,
      cta: null,
    },
    {
      number: 2,
      title: 'Define your offer',
      description: 'One or two sentences on the specific expertise you’re selling, and at what level.',
      completed: !!profile.interimOfferDefinition,
      cta: null,
    },
    {
      number: 3,
      title: 'Package your proof',
      description: 'A work sample is the fastest way to make your offer concrete instead of abstract.',
      completed: profile.workSamples.length > 0,
      cta: { label: 'Add a work sample', href: '/dashboard/work-samples' },
    },
    {
      number: 4,
      title: 'Get positioned publicly',
      description: 'A profile that reads as available for interim work is what makes inbound possible.',
      completed: profile.linkedinProfileUpToDate === true,
      cta: { label: 'Update your LinkedIn', href: '/dashboard/linkedin' },
    },
    {
      number: 5,
      title: 'Activate your network',
      description: 'Most interim work comes through a warm introduction, not a marketplace application.',
      completed: outreachCount > 0,
      cta: { label: 'Log an outreach', href: '/dashboard/network' },
    },
    {
      number: 6,
      title: 'Browse & reach out',
      description: 'Pick 2-3 platforms below that fit your offer and create a profile on each.',
      completed: !!profile.interimOutreachStartedAt,
      cta: null,
    },
  ]
}
