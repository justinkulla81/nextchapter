'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { isPaidChannel, type PaidChannel } from '@/lib/admin/paid-channels'

export type SaveSpendResult = { ok: true; day: string; channel: PaidChannel; segment: 'b2c' | 'b2b'; dollars: number } | { ok: false; message: string }

// One day's spend on one ad channel for one segment. Saving the same day, channel and segment again replaces it.
export async function saveSemSpend(input: { day: string; channel: string; segment: string; dollars: string }): Promise<SaveSpendResult> {
  await requireAdmin()
  if (!isPaidChannel(input.channel)) return { ok: false, message: 'Choose the ad channel the money was spent on.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day) || Number.isNaN(Date.parse(`${input.day}T12:00:00Z`))) return { ok: false, message: 'Pick a valid date.' }
  if (input.segment !== 'b2c' && input.segment !== 'b2b') return { ok: false, message: 'Choose B2C or B2B.' }
  const dollars = Number(input.dollars.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100_000) return { ok: false, message: 'Enter the amount spent in dollars, for example 42.50.' }
  const amountCents = Math.round(dollars * 100)
  try {
    await prisma.semSpend.upsert({
      where: { day_channel_segment: { day: input.day, channel: input.channel, segment: input.segment } },
      create: { day: input.day, channel: input.channel, segment: input.segment, amountCents },
      update: { amountCents },
    })
  } catch (error) {
    console.error('Saving paid search spend failed:', error)
    return { ok: false, message: 'The spend was not saved. Check your connection and try again.' }
  }
  revalidatePath('/support/admin/visitors/activity')
  return { ok: true, day: input.day, channel: input.channel, segment: input.segment, dollars: amountCents / 100 }
}
