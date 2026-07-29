'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { InterimListingCategory, InterimListingDesignation } from '@prisma/client'

export type FormState = { error?: string } | undefined

export async function createInterimListing(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const category = formData.get('category') as InterimListingCategory | null
  const name = (formData.get('name') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim()
  const url = (formData.get('url') as string | null)?.trim()
  const designation = (formData.get('designation') as InterimListingDesignation | null) ?? 'INCLUDED_FOR_QUALITY'
  const designationNote = (formData.get('designationNote') as string | null)?.trim()

  if (!category) return { error: 'Category is required.' }
  if (!name) return { error: 'Name is required.' }
  if (!description) return { error: 'Description is required.' }
  if (!url) return { error: 'URL is required.' }

  const listing = await prisma.interimListing.create({
    data: { category, name, description, url, designation, designationNote: designationNote || null },
  })

  captureServerEvent(admin?.email ?? 'admin', 'interim_listing_created', { listingId: listing.id, category })
  revalidatePath('/support/admin/interim-listings')
}

export async function toggleInterimListingActive(listingId: string, current: boolean) {
  await requireAdmin()
  await prisma.interimListing.update({ where: { id: listingId }, data: { isActive: !current } })
  revalidatePath('/support/admin/interim-listings')
}

export async function updateInterimListingDesignation(
  listingId: string,
  designation: InterimListingDesignation
) {
  await requireAdmin()
  await prisma.interimListing.update({ where: { id: listingId }, data: { designation } })
  revalidatePath('/support/admin/interim-listings')
  revalidatePath('/dashboard/interim-work')
}
