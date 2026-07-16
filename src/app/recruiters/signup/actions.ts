'use server'

import { prisma } from '@/lib/prisma'

export type FormState = { error?: string; accessToken?: string } | undefined

export async function createRecruiter(_prevState: FormState, formData: FormData): Promise<FormState> {
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const workEmail = (formData.get('workEmail') as string | null)?.trim().toLowerCase()
  const firmName = (formData.get('firmName') as string | null)?.trim() || null
  const specialty = (formData.get('specialty') as string | null)?.trim() || null

  if (!fullName || !workEmail) {
    return { error: 'Please fill in your name and work email.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return { error: 'Please enter a valid email address.' }
  }

  const existing = await prisma.recruiter.findUnique({ where: { workEmail } })
  if (existing) {
    return { accessToken: existing.accessToken }
  }

  const recruiter = await prisma.recruiter.create({
    data: { fullName, workEmail, firmName, specialty },
  })

  return { accessToken: recruiter.accessToken }
}
