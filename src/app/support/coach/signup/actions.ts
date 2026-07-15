'use server'

import type { CoachingFocus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type FormState = { error?: string; accessToken?: string } | undefined

const FOCUS_OPTIONS: CoachingFocus[] = ['CAREER', 'LIFE', 'EXECUTIVE', 'EOS', 'OTHER']

export async function createCoach(_prevState: FormState, formData: FormData): Promise<FormState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const workEmail = (formData.get('workEmail') as string | null)?.trim().toLowerCase()
  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const focus = formData.get('focus') as CoachingFocus | null

  if (!fullName || !workEmail || !focus || !FOCUS_OPTIONS.includes(focus)) {
    return { error: 'Please fill in your name, work email, and coaching focus.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return { error: 'Please enter a valid email address.' }
  }

  const existing = await prisma.coach.findUnique({ where: { workEmail } })
  if (existing) {
    return { accessToken: existing.accessToken }
  }

  const coach = await prisma.coach.create({
    data: { fullName, workEmail, firmName, focus },
  })

  return { accessToken: coach.accessToken }
}
